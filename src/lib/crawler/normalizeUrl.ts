// Tracking params to remove
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'dclid', 'twclid',
  'mc_cid', 'mc_eid',
  '_ga', '_gl',
  'ref', 'referrer',
];

// UTM source domains to detect external refs
const SOCIAL_REF_DOMAINS = ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'google.com'];

export function normalizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);

    // Remove trailing slash except for root
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }

    // Remove hash
    url.hash = '';

    // Remove tracking params
    for (const param of TRACKING_PARAMS) {
      url.searchParams.delete(param);
    }

    // Normalize hostname: strip www
    url.hostname = url.hostname.replace(/^www\./, '');

    return url.toString();
  } catch {
    throw new Error(`Invalid URL: ${urlString}`);
  }
}

export function isSameDomain(url1: string, url2: string): boolean {
  try {
    const a = new URL(url1);
    const b = new URL(url2);
    const domainA = a.hostname.replace(/^www\./, '');
    const domainB = b.hostname.replace(/^www\./, '');
    return domainA === domainB;
  } catch {
    return false;
  }
}

export function isInternalPath(path: string): boolean {
  // Skip common non-content paths
  const skipPatterns = [
    /^\/wp-admin/, /^\/wp-content/, /^\/wp-includes/,
    /^\/tag\//, /^\/category\//, /^\/author\//,
    /^\/feed\/?$/, /^\/sitemap/, /^\/robots\.txt/,
    /^\/search/, /^\/checkout/, /^\/cart/,
    /^\/account/, /^\/login/, /^\/register/,
    /^\/blog\/page\/\d+/, /^\/page\/\d+/,
    /\.(pdf|zip|doc|docx|xls|xlsx|ppt|pptx)$/i,
  ];

  return !skipPatterns.some(p => p.test(path));
}

export function getPathDepth(url: string): number {
  try {
    const u = new URL(url);
    return u.pathname.split('/').filter(Boolean).length;
  } catch {
    return 0;
  }
}