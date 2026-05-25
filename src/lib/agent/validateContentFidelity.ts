import type { SiteSpec, FactualSiteData, ContentFidelityResult } from './schemas';

/**
 * Hallucinated content patterns to block.
 * These are known fake values that sometimes appear in generated sites.
 */
const HALLUCINATION_PATTERNS = [
  // Fake business names
  { pattern: /sterling immigration law/i, type: 'fakeBusinessName', reason: 'Common hallucination pattern' },
  { pattern: /sterling law/i, type: 'fakeBusinessName', reason: 'Common hallucination pattern' },

  // Fake contact info
  { pattern: /contact@example/i, type: 'fakeEmail', reason: 'Example email placeholder' },
  { pattern: /info@example/i, type: 'fakeEmail', reason: 'Example email placeholder' },
  { pattern: /\(555\)\s*\d{3}[-\s]?\d{4}/i, type: 'fakePhone', reason: '555 prefix is fake' },
  { pattern: /123\s+legal\s+plaza/i, type: 'fakeAddress', reason: 'Fake address placeholder' },
  { pattern: /123\s+\d+\s+(st|ave|road)/i, type: 'fakeAddress', reason: '123 street number is placeholder' },

  // Fake awards/ratings
  { pattern: /A\+[\s-]?rated?/i, type: 'fakeAward', reason: 'BBB rating not verified' },
  { pattern: /thousands of (successful |)(cases|clients|patients)/i, type: 'fakeClaim', reason: 'Unverified case count' },
  { pattern: /\d+[\s-]?years? (of )?(experience|success)/i, type: 'fakeClaim', reason: 'Years not verified' },
  { pattern: /\d+[\s-]?(year|yr)[\s-]?(experience|old)/i, type: 'fakeClaim', reason: 'Years not verified' },

  // Immigration terms when industry is NOT immigration
  { pattern: /H-?1B/i, type: 'wrongIndustry', reason: 'H-1B is immigration visa, check industry match' },
  { pattern: /green\s*(card|car[ds])/i, type: 'wrongIndustry', reason: 'Green card is immigration, check industry match' },
  { pattern: /DACA/i, type: 'wrongIndustry', reason: 'DACA is immigration program, check industry match' },
  { pattern: /deportation[\s-]*(defense|representation)/i, type: 'wrongIndustry', reason: 'Deportation is immigration, check industry match' },
  { pattern: /USCIS/i, type: 'wrongIndustry', reason: 'USCIS is immigration agency, check industry match' },
  { pattern: /naturalization/i, type: 'wrongIndustry', reason: 'Naturalization is immigration, check industry match' },
  { pattern: /work\s*visa/i, type: 'wrongIndustry', reason: 'Work visa is immigration, check industry match' },
  { pattern: /citizenship\s*application/i, type: 'wrongIndustry', reason: 'Citizenship is immigration, check industry match' },

  // Fake testimonials patterns
  { pattern: /testimonial/i, type: 'genericPlaceholder', reason: 'Generic testimonial placeholder' },
];

const IMMIGRATION_INDUSTRY_KEYWORDS = ['immigration', 'visa', 'naturalization', 'green card', 'deportation', 'asylum', ' DACA', 'USCIS', 'H-1B', 'work permit'];

/**
 * Validates that the generated siteSpec is factually faithful to the original website.
 * This is a deterministic check - no LLM involved.
 */
export function validateContentFidelity(
  siteSpec: SiteSpec,
  factualData: FactualSiteData
): ContentFidelityResult {
  const issues: string[] = [];
  const details: Record<string, string> = {};

  // 1. Check siteTitle includes actual business name words
  const businessNameWords = factualData.businessName.toLowerCase().split(/[\s,.-]+/).filter(w => w.length > 2);
  const titleLower = siteSpec.siteTitle.toLowerCase();
  const nameMatchCount = businessNameWords.filter(word => titleLower.includes(word)).length;

  if (nameMatchCount === 0 && businessNameWords.length > 0) {
    issues.push(`Site title "${siteSpec.siteTitle}" does not contain any words from business name "${factualData.businessName}"`);
    details['siteTitleIssue'] = `Expected words from: ${factualData.businessName}`;
  } else {
    details['siteTitleMatch'] = `Matched ${nameMatchCount}/${businessNameWords.length} words from business name`;
  }

  // 2. Check services/practice areas overlap
  const specServices = siteSpec.sections
    .filter(s => s.type === 'services' || s.type === 'hero')
    .flatMap(s => s.items.map(item => item.toLowerCase()));

  const factualServices = factualData.practiceAreasOrServices.map(s => s.toLowerCase());

  const matchingServices = specServices.filter(s =>
    factualServices.some(fs => fs.includes(s) || s.includes(fs))
  );

  // Check for immigration terms when not immigration
  const factualIndustry = factualData.industry.toLowerCase();
  const isImmigrationIndustry = IMMIGRATION_INDUSTRY_KEYWORDS.some(k => factualIndustry.includes(k));

  if (!isImmigrationIndustry) {
    // Check if generated site has immigration content
    const allSpecContent = [
      siteSpec.siteTitle,
      siteSpec.tagline,
      ...siteSpec.sections.map(s => s.title + ' ' + s.body + ' ' + s.items.join(' '))
    ].join(' ').toLowerCase();

    const foundImmigrationTerms = IMMIGRATION_INDUSTRY_KEYWORDS.filter(term =>
      allSpecContent.includes(term.toLowerCase())
    );

    if (foundImmigrationTerms.length > 0) {
      issues.push(`Generated site contains immigration terms [${foundImmigrationTerms.join(', ')}] but original is "${factualData.industry}" - possible hallucination`);
      details['wrongIndustryTerms'] = foundImmigrationTerms.join(', ');
    }
  }

  // 3. Check phone numbers match
  if (factualData.phoneNumbers.length > 0) {
    const siteSpecPhonePattern = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phonesInSpec = siteSpec.siteTitle + ' ' + siteSpec.sections.map(s =>
      s.title + ' ' + s.body + ' ' + s.items.join(' ')
    ).join(' ');

    const foundPhones = phonesInSpec.match(siteSpecPhonePattern) || [];

    // Check if at least one phone from factual data is in the spec
    // Normalized found phone (10 digits) should be a substring of normalized extracted phone (may have +1 prefix = 11 digits)
    const phoneMatch = foundPhones.some(found => {
      const normalizedFound = found.replace(/\D/g, '');
      return factualData.phoneNumbers.some(fp => {
        const normalizedFp = fp.replace(/\D/g, '');
        return normalizedFp.includes(normalizedFound) || normalizedFound.includes(normalizedFp);
      });
    });

    if (foundPhones.length > 0 && !phoneMatch) {
      issues.push(`Generated site has phone numbers [${foundPhones.join(', ')}] but none match extracted phones [${factualData.phoneNumbers.join(', ')}]`);
      details['phoneMismatch'] = `Found: ${foundPhones.join(', ')} | Expected: ${factualData.phoneNumbers.join(', ')}`;
    }
  }

  // 4. Check email matches
  if (factualData.emails.length > 0) {
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailsInSpec = siteSpec.sections.map(s => s.items.join(' ')).join(' ');
    const foundEmails = emailsInSpec.match(emailPattern) || [];

    if (foundEmails.length > 0) {
      const emailMatch = factualData.emails.some(fe => fe.toLowerCase() === foundEmails[0]?.toLowerCase());
      if (!emailMatch) {
        issues.push(`Generated site email [${foundEmails[0]}] does not match extracted [${factualData.emails.join(', ')}]`);
        details['emailMismatch'] = `Found: ${foundEmails[0]} | Expected: ${factualData.emails.join(', ')}`;
      }
    }
  }

  // 5. Check for known hallucination patterns
  const allContent = [
    siteSpec.siteTitle,
    siteSpec.tagline,
    ...siteSpec.sections.map(s => s.title + ' ' + s.body + ' ' + s.items.join(' '))
  ].join(' ');

  for (const { pattern, type, reason } of HALLUCINATION_PATTERNS) {
    if (pattern.test(allContent)) {
      issues.push(`Hallucination pattern detected: ${type} - ${reason}`);
      details[`hallucination_${type}`] = 'matched';
    }
  }

  // 6. Check service areas consistency
  if (factualData.serviceAreas.length > 0) {
    const serviceAreasText = factualData.serviceAreas.join(' ').toLowerCase();
    const specContent = siteSpec.sections.map(s => s.title + ' ' + s.body).join(' ');

    // If original mentions counties, ensure generated site doesn't claim different counties
    const originalHasCounties = /harris|fort bend|galveston|brazoria|montgomery/i.test(serviceAreasText);
    if (originalHasCounties) {
      // Check that generated site doesn't contradict
      const specLower = specContent.toLowerCase();
      const wrongCounties = ['dallas', 'austin', 'travis', 'bexar'].filter(c => specLower.includes(c) && !serviceAreasText.includes(c));
      if (wrongCounties.length > 0) {
        issues.push(`Generated site mentions counties [${wrongCounties.join(', ')}] not in original service area`);
        details['wrongCounties'] = wrongCounties.join(', ');
      }
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    details,
  };
}

/**
 * Extracts key facts from siteSpec for logging/debugging
 */
export function extractSiteSpecFacts(siteSpec: SiteSpec): Record<string, string[]> {
  const facts: Record<string, string[]> = {
    titles: [siteSpec.siteTitle],
    services: [],
    phones: [],
    emails: [],
    locations: [],
  };

  for (const section of siteSpec.sections) {
    if (section.type === 'services') {
      facts.services.push(...section.items);
    }
    // Extract potential phones and emails from items
    for (const item of section.items) {
      const phoneMatch = item.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch) facts.phones.push(phoneMatch[0]);
      const emailMatch = item.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) facts.emails.push(emailMatch[0]);
    }
  }

  return facts;
}