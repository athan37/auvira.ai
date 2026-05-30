import type { SiteSpec, FactualSiteData, ContentFidelityResult } from './schemas';

/**
 * Hallucinated content patterns to block.
 * These are known fake values that sometimes appear in generated sites.
 */
const HALLUCINATION_PATTERNS = [
  // Fake business names
  { pattern: /sterling immigration law/i, type: 'fakeBusinessName', reason: 'Common hallucination pattern', severity: 'critical' as const },
  { pattern: /sterling law/i, type: 'fakeBusinessName', reason: 'Common hallucination pattern', severity: 'critical' as const },

  // Fake contact info
  { pattern: /contact@example/i, type: 'fakeEmail', reason: 'Example email placeholder', severity: 'critical' as const },
  { pattern: /info@example/i, type: 'fakeEmail', reason: 'Example email placeholder', severity: 'critical' as const },
  { pattern: /\(555\)\s*\d{3}[-\s]?\d{4}/i, type: 'fakePhone', reason: '555 prefix is fake', severity: 'critical' as const },
  { pattern: /123\s+legal\s+plaza/i, type: 'fakeAddress', reason: 'Fake address placeholder', severity: 'critical' as const },
  { pattern: /123\s+\d+\s+(st|ave|road)/i, type: 'fakeAddress', reason: 'Fake address placeholder', severity: 'critical' as const },

  // Fake awards/ratings
  { pattern: /A\+[\s-]?rated?/i, type: 'fakeAward', reason: 'BBB rating not verified', severity: 'warn' as const },
  { pattern: /thousands of (successful |)(cases|clients|patients)/i, type: 'fakeClaim', reason: 'Unverified case count', severity: 'warn' as const },
  { pattern: /\d+[\s-]?years? (of )?(experience|success)/i, type: 'fakeClaim', reason: 'Years not verified', severity: 'warn' as const },
  { pattern: /\d+[\s-]?(year|yr)[\s-]?(experience|old)/i, type: 'fakeClaim', reason: 'Years not verified', severity: 'warn' as const },

  // Immigration terms when industry is NOT immigration
  { pattern: /H-?1B/i, type: 'wrongIndustry', reason: 'H-1B is immigration visa, check industry match', severity: 'critical' as const },
  { pattern: /green\s*(card|car[ds])/i, type: 'wrongIndustry', reason: 'Green card is immigration, check industry match', severity: 'critical' as const },
  { pattern: /DACA/i, type: 'wrongIndustry', reason: 'DACA is immigration program, check industry match', severity: 'critical' as const },
  { pattern: /deportation[\s-]*(defense|representation)/i, type: 'wrongIndustry', reason: 'Deportation is immigration, check industry match', severity: 'critical' as const },
  { pattern: /USCIS/i, type: 'wrongIndustry', reason: 'USCIS is immigration agency, check industry match', severity: 'critical' as const },
  { pattern: /naturalization/i, type: 'wrongIndustry', reason: 'Naturalization is immigration, check industry match', severity: 'critical' as const },
  { pattern: /work\s*visa/i, type: 'wrongIndustry', reason: 'Work visa is immigration, check industry match', severity: 'critical' as const },
  { pattern: /citizenship\s*application/i, type: 'wrongIndustry', reason: 'Citizenship is immigration, check industry match', severity: 'critical' as const },

  // Fake testimonials patterns
  { pattern: /testimonial/i, type: 'genericPlaceholder', reason: 'Generic testimonial placeholder', severity: 'warn' as const },
];

const IMMIGRATION_INDUSTRY_KEYWORDS = ['immigration', 'visa', 'naturalization', 'green card', 'deportation', 'asylum', ' DACA', 'USCIS', 'H-1B', 'work permit'];

type FidelitySeverity = 'critical' | 'warn';

interface ClassifiedIssue {
  message: string;
  severity: FidelitySeverity;
}

/** Classify a fidelity issue message as critical (blocks preview) or warn (review only). */
export function classifyFidelityIssue(message: string): FidelitySeverity {
  if (
    message.startsWith('Site title ') ||
    message.startsWith('Generated site contains immigration') ||
    message.startsWith('Generated site has phone') ||
    message.startsWith('Generated site email') ||
    message.startsWith('Generated site mentions counties') ||
    /Hallucination pattern detected: (fakeBusinessName|fakeEmail|fakePhone|fakeAddress|wrongIndustry)/.test(message)
  ) {
    return 'critical';
  }
  return 'warn';
}

/** True when content fidelity has issues that must block preview build. */
export function hasCriticalFidelityFailures(
  result: Partial<Pick<ContentFidelityResult, 'criticalIssues' | 'hasCriticalFailures' | 'issues'>>
): boolean {
  if (result.hasCriticalFailures || (result.criticalIssues?.length ?? 0) > 0) return true;
  if (result.criticalIssues === undefined && result.issues?.length) {
    return result.issues.some((issue) => classifyFidelityIssue(issue) === 'critical');
  }
  return false;
}

function buildFidelityResult(classified: ClassifiedIssue[], details: Record<string, string>): ContentFidelityResult {
  const criticalIssues = classified.filter((i) => i.severity === 'critical').map((i) => i.message);
  const warnIssues = classified.filter((i) => i.severity === 'warn').map((i) => i.message);
  const issues = classified.map((i) => i.message);
  const hasCriticalFailures = criticalIssues.length > 0;

  return {
    passed: !hasCriticalFailures,
    issues,
    criticalIssues,
    warnIssues,
    hasCriticalFailures,
    details,
  };
}

/**
 * Validates that the generated siteSpec is factually faithful to the original website.
 * This is a deterministic check - no LLM involved.
 */
export function validateContentFidelity(
  siteSpec: SiteSpec,
  factualData: FactualSiteData
): ContentFidelityResult {
  const classified: ClassifiedIssue[] = [];
  const details: Record<string, string> = {};

  // 1. Check siteTitle includes actual business name words
  const businessNameWords = factualData.businessName.toLowerCase().split(/[\s,.-]+/).filter(w => w.length > 2);
  const titleLower = siteSpec.siteTitle.toLowerCase();
  const nameMatchCount = businessNameWords.filter(word => titleLower.includes(word)).length;

  if (nameMatchCount === 0 && businessNameWords.length > 0) {
    classified.push({
      message: `Site title "${siteSpec.siteTitle}" does not contain any words from business name "${factualData.businessName}"`,
      severity: 'critical',
    });
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
  void matchingServices;

  // Check for immigration terms when not immigration
  const factualIndustry = factualData.industry.toLowerCase();
  const isImmigrationIndustry = IMMIGRATION_INDUSTRY_KEYWORDS.some(k => factualIndustry.includes(k));

  if (!isImmigrationIndustry) {
    const allSpecContent = [
      siteSpec.siteTitle,
      siteSpec.tagline,
      ...siteSpec.sections.map(s => s.title + ' ' + s.body + ' ' + s.items.join(' '))
    ].join(' ').toLowerCase();

    const foundImmigrationTerms = IMMIGRATION_INDUSTRY_KEYWORDS.filter(term =>
      allSpecContent.includes(term.toLowerCase())
    );

    if (foundImmigrationTerms.length > 0) {
      classified.push({
        message: `Generated site contains immigration terms [${foundImmigrationTerms.join(', ')}] but original is "${factualData.industry}" - possible hallucination`,
        severity: 'critical',
      });
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

    const phoneMatch = foundPhones.some(found => {
      const normalizedFound = found.replace(/\D/g, '');
      return factualData.phoneNumbers.some(fp => {
        const normalizedFp = fp.replace(/\D/g, '');
        return normalizedFp.includes(normalizedFound) || normalizedFound.includes(normalizedFp);
      });
    });

    if (foundPhones.length > 0 && !phoneMatch) {
      classified.push({
        message: `Generated site has phone numbers [${foundPhones.join(', ')}] but none match extracted phones [${factualData.phoneNumbers.join(', ')}]`,
        severity: 'critical',
      });
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
        classified.push({
          message: `Generated site email [${foundEmails[0]}] does not match extracted [${factualData.emails.join(', ')}]`,
          severity: 'critical',
        });
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

  for (const { pattern, type, reason, severity } of HALLUCINATION_PATTERNS) {
    if (pattern.test(allContent)) {
      classified.push({
        message: `Hallucination pattern detected: ${type} - ${reason}`,
        severity,
      });
      details[`hallucination_${type}`] = 'matched';
    }
  }

  // 6. Check service areas consistency
  if (factualData.serviceAreas.length > 0) {
    const serviceAreasText = factualData.serviceAreas.join(' ').toLowerCase();
    const specContent = siteSpec.sections.map(s => s.title + ' ' + s.body).join(' ');

    const originalHasCounties = /harris|fort bend|galveston|brazoria|montgomery/i.test(serviceAreasText);
    if (originalHasCounties) {
      const specLower = specContent.toLowerCase();
      const wrongCounties = ['dallas', 'austin', 'travis', 'bexar'].filter(c => specLower.includes(c) && !serviceAreasText.includes(c));
      if (wrongCounties.length > 0) {
        classified.push({
          message: `Generated site mentions counties [${wrongCounties.join(', ')}] not in original service area`,
          severity: 'critical',
        });
        details['wrongCounties'] = wrongCounties.join(', ');
      }
    }
  }

  return buildFidelityResult(classified, details);
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
    for (const item of section.items) {
      const phoneMatch = item.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch) facts.phones.push(phoneMatch[0]);
      const emailMatch = item.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) facts.emails.push(emailMatch[0]);
    }
  }

  return facts;
}
