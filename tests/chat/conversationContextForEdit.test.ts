import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDIT_CONTEXT_TURNS,
  extractGalleryImageCountFromAssistant,
  extractSectionPickFromListReply,
  extractSectionTitleFromListReply,
  formatConversationForIntentClarifier,
  formatWeightedConversationForPrompt,
  messageExplicitlyExcludesHero,
  messageRefersToHeroStyle,
  inheritSelectedTargetForClarificationReply,
  resolveEffectiveEditMessage,
  wasRecentGalleryImageSectionCreated,
} from '../../src/lib/chat/conversationContextForEdit';

describe('conversationContextForEdit', () => {
  it('weights closest turns with more stars in prompt output', () => {
    const block = formatWeightedConversationForPrompt([
      { role: 'user', content: 'older request' },
      { role: 'assistant', content: 'Which section?' },
      { role: 'user', content: 'latest request' },
    ]);

    expect(block).toContain('CONVERSATION CONTEXT (recency-weighted');
    expect(block).toContain('★★★ User [CURRENT — highest weight]: latest request');
    expect(block).toContain('★★ Assistant [high recency]: Which section?');
    expect(block).toContain('★ User: older request');
  });

  it('inherits preview pin from prior user turn on color clarification reply', () => {
    const pinned = {
      kind: 'section' as const,
      sectionIndex: 4,
      sectionType: 'contact',
      sectionTitle: 'Contact Us',
      fieldPath: 'sections[4].subtitle',
      elementLabel: 'Contact Information',
      targetChain: [
        { role: 'section' as const, label: 'Contact Us', kind: 'contact' },
        { role: 'container' as const, label: 'Contact card', kind: 'inner_card' },
        {
          role: 'element' as const,
          label: 'Contact Information',
          kind: 'heading',
          fieldPath: 'sections[4].subtitle',
        },
      ],
    };
    const history = [
      {
        role: 'user' as const,
        content: 'change this to my favourite color',
        metadata: { selectedTarget: pinned },
      },
      { role: 'assistant' as const, content: 'What color should I use?' },
    ];

    const inherited = inheritSelectedTargetForClarificationReply('green', history, null);
    expect(inherited?.sectionType).toBe('contact');
    expect(inherited?.elementLabel).toBe('Contact Information');
    expect(inherited?.targetChain?.some((n) => n.kind === 'inner_card')).toBe(true);
  });

  it('merges color clarification follow-up with prior user intent', () => {
    const history = [
      { role: 'user' as const, content: 'change this to my favourite color' },
      {
        role: 'assistant' as const,
        content: 'What color should I use?',
        metadata: { pendingImplicitRef: { phrase: 'my favourite color', kind: 'color' } },
      },
    ];

    const effective = resolveEffectiveEditMessage('Green', history);
    expect(effective).toContain('change this to my favourite color');
    expect(effective.toLowerCase()).toContain('green');
  });

  it('merges section number reply with prior user intent', () => {
    const history = [
      { role: 'user' as const, content: 'change background to red' },
      {
        role: 'assistant' as const,
        content:
          'Which section should I change? Reply with the number:\n\n1. [0] gallery — "Our Work"\n2. [1] services — "Grow"',
      },
    ];

    const effective = resolveEffectiveEditMessage('1', history);
    expect(effective).toContain('change background to red');
    expect(effective).toContain('Our Work');
    expect(effective).toMatch(/section index: 0|section index 0/i);
  });

  it('merges style clarification follow-up with prior request', () => {
    const history = [
      { role: 'user' as const, content: 'change this section to red: Our Work' },
      {
        role: 'assistant' as const,
        content:
          'can you confirm what you want to restyle (e.g. card backgrounds, text color, or the whole section background)?',
      },
    ];

    const effective = resolveEffectiveEditMessage('whole section background', history);
    expect(effective).toContain('change this section to red');
    expect(effective).toContain('whole section background');
  });

  it('includes resolved request block in intent clarifier format', () => {
    const block = formatConversationForIntentClarifier('1', [
      { role: 'user', content: 'make gallery background blue' },
      {
        role: 'assistant',
        content: 'Which section should I change? Reply with the number:\n\n1. [0] gallery — "Our Work"',
      },
    ]);

    expect(block).toContain('RESOLVED REQUEST');
    expect(block).toContain('gallery background blue');
    expect(block).toContain('Our Work');
  });

  it('extractSectionPickFromListReply returns bracket index and title', () => {
    const assistant =
      'Which section should I change? Reply with the number:\n\n3. [2] gallery — "Hello"';
    expect(extractSectionTitleFromListReply(assistant, 3)).toBe('Hello');
    const pick = extractSectionPickFromListReply(assistant, 3);
    expect(pick?.sectionIndex).toBe(2);
    expect(pick?.title).toBe('Hello');
  });

  it('merges section number reply after a wrong confirmation still uses the numbered list', () => {
    const catalogList =
      'Which section do you mean? Reply with the number:\n\n' +
      '1. [0] services — "Everything You Need to Grow Your Business"\n' +
      '5. [4] contact — "Get Started Today"';
    const history = [
      { role: 'user' as const, content: 'Change the background color of this section to orange' },
      { role: 'assistant' as const, content: catalogList },
      { role: 'user' as const, content: '5' },
      { role: 'assistant' as const, content: 'Updated "Get Started Today" background to orange.' },
    ];

    const effective = resolveEffectiveEditMessage('1', history);
    expect(effective).toContain('orange');
    expect(effective).toContain('Everything You Need to Grow Your Business');
    expect(effective).toContain('section index 0');
  });

  it('uses eight turns by default for edit context', () => {
    expect(DEFAULT_EDIT_CONTEXT_TURNS).toBe(16);
  });

  it('merges gallery description follow-up after product section with images', () => {
    const history = [
      { role: 'user' as const, content: 'add these images to a new sections' },
      {
        role: 'assistant' as const,
        content:
          'Added your product section with 4 image(s) in the preview. Scroll just below the hero to see it.',
      },
    ];

    expect(wasRecentGalleryImageSectionCreated(history)).toBe(true);
    expect(
      extractGalleryImageCountFromAssistant(
        'Added your product section with 4 image(s) in the preview.'
      )
    ).toBe(4);

    const effective = resolveEffectiveEditMessage('add more description to these images', history);
    expect(effective).toContain('add these images to a new sections');
    expect(effective).toContain('add more description to these images');
    expect(effective).toMatch(/gallery\/product section with 4 uploaded image/i);
  });

  it('merges singular that-image follow-up after 1-image gallery placement', () => {
    const history = [
      { role: 'user' as const, content: 'add this image to a new section' },
      {
        role: 'assistant' as const,
        content:
          'Added your product section with 1 image(s) in the preview. Scroll just below the hero to see it.',
      },
    ];

    const effective = resolveEffectiveEditMessage('add some description to that image', history);
    expect(effective).toContain('add this image to a new section');
    expect(effective).toContain('add some description to that image');
    expect(effective).toMatch(/1 uploaded image/i);
  });

  it('merges compound numbered image+description message', () => {
    const effective = resolveEffectiveEditMessage(
      '1) add this image to a new section and 2) add some description to that image',
      []
    );
    expect(effective).toContain('compound');
    expect(effective).toContain('placeholder descriptions');
  });

  it('merges vague them after double gallery placement', () => {
    const history = [
      { role: 'user' as const, content: 'add these images to a new section called Showcase' },
      {
        role: 'assistant' as const,
        content: 'Added your product section with 2 image(s) in the preview.',
      },
      { role: 'user' as const, content: 'add this image to a new section' },
      {
        role: 'assistant' as const,
        content: 'Added your product section with 1 image(s) in the preview.',
      },
    ];
    const effective = resolveEffectiveEditMessage('can you add captions to them', history);
    expect(effective).toMatch(/1 uploaded image/i);
  });

  it('merges caption follow-up after generic assistant image confirmation', () => {
    const history = [
      { role: 'user' as const, content: 'add this image to a new section' },
      { role: 'assistant' as const, content: 'Your images are live in the preview now.' },
    ];

    expect(wasRecentGalleryImageSectionCreated(history)).toBe(true);

    const effective = resolveEffectiveEditMessage('add some description to that image', history);
    expect(effective).toContain('add this image to a new section');
    expect(effective).toMatch(/gallery\/product section|uploaded image|most recently added gallery/i);
  });

  it('merges caption follow-up after intervening style edit in history', () => {
    const history = [
      { role: 'user' as const, content: 'add this image to a new section' },
      {
        role: 'assistant' as const,
        content: 'Added your product section with 1 image(s) in the preview.',
      },
      { role: 'user' as const, content: 'change the background color of the "Our Work" section to black' },
      { role: 'assistant' as const, content: 'Changed background of "Our Work" to bg-black.' },
    ];
    const effective = resolveEffectiveEditMessage('add some description to that image', history);
    expect(effective).toContain('add this image to a new section');
    expect(effective).toMatch(/1 uploaded image/i);
  });

  it('merges hero gradient follow-up with prior background request', () => {
    const heroMsg =
      'change color of the "Your HVAC Website Should Work as Hard as You Do" section\'s background from red to green color gradient';
    const merged = resolveEffectiveEditMessage('Linear gradient from #16a34a to #15803d (top to bottom)', [
      { role: 'user', content: heroMsg },
      { role: 'assistant', content: 'Which green gradient?' },
    ]);
    expect(merged).toContain('Your HVAC Website Should Work as Hard as You Do');
    expect(merged).toContain('#16a34a');
  });

  it('merges 4-turn hero clarification: hero section → Background color → Blue to green gradient', () => {
    const history = [
      { role: 'user' as const, content: 'improve color of this section (hero section)' },
      {
        role: 'assistant' as const,
        content: 'Which color would you like to improve on the hero section?',
      },
      { role: 'user' as const, content: 'Background color' },
      {
        role: 'assistant' as const,
        content:
          'What background color or gradient would you like for this section? For example, solid color or gradient.',
      },
    ];
    const merged = resolveEffectiveEditMessage('Blue to green gradient', history);
    expect(merged.toLowerCase()).toContain('hero');
    expect(merged.toLowerCase()).toContain('improve color');
    expect(merged.toLowerCase()).toContain('gradient');
  });

  it('messageRefersToHeroStyle ignores explicit not-the-hero scoping', () => {
    const msg =
      'Change the first content section (not the hero) background to teal — the one titled Everything You Need to Grow Your Business';
    expect(messageExplicitlyExcludesHero(msg)).toBe(true);
    expect(messageRefersToHeroStyle(msg)).toBe(false);
    expect(messageRefersToHeroStyle('improve color of this section (hero section)')).toBe(true);
  });

  it('does not merge hero clarification when current turn has explicit catalog section target', async () => {
    const history = [
      { role: 'user' as const, content: 'improve color of this section (hero section)' },
      {
        role: 'assistant' as const,
        content: 'Which color would you like to improve on the hero section?',
      },
      { role: 'user' as const, content: 'Background color' },
      {
        role: 'assistant' as const,
        content: 'What background color or gradient would you like for this section?',
      },
      { role: 'user' as const, content: 'Blue to green gradient' },
      { role: 'assistant' as const, content: 'Updated hero background.' },
    ];
    const servicesMsg = 'Make the section about services have a purple background';
    const { buildSiteSectionCatalog } = await import(
      '@/lib/project-workspace/edit-shared/siteSectionCatalog'
    );
    const { heroClarificationReplaySiteSpec } = await import(
      '../support/heroClarificationReplaySiteSpec'
    );
    const { buildSyntheticSiteConfigSource, buildSyntheticPageSource } = await import(
      '../support/syntheticSiteWorkspace'
    );
    const spec = heroClarificationReplaySiteSpec();
    const catalog = buildSiteSectionCatalog(
      buildSyntheticSiteConfigSource(spec),
      buildSyntheticPageSource(spec, 'wired')
    );
    expect(resolveEffectiveEditMessage(servicesMsg, history, null, null, { catalog })).toBe(
      servicesMsg
    );
  });
});
