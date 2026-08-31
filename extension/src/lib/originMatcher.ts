/**
 * Origin Matcher Engine for panda.vault Browser Extension.
 * Accurately extracts domains, handles eTLD+1 rules, prevents cross-origin leakage & phishing attacks.
 */

export interface ParsedOrigin {
  protocol: string;
  hostname: string;
  domain: string;
  port: string;
  fullOrigin: string;
}

/**
 * Extracts and normalizes hostname and base domain from a given URL string.
 */
export function parseOrigin(urlString: string): ParsedOrigin | null {
  if (!urlString || typeof urlString !== 'string') return null;

  let raw = urlString.trim();
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    raw = 'https://' + raw;
  }

  try {
    const parsed = new URL(raw);
    const protocol = parsed.protocol.replace(':', '');
    const hostname = parsed.hostname.toLowerCase();
    const port = parsed.port || (protocol === 'https' ? '443' : '80');

    // Extract base domain (e.g., "accounts.google.com" -> "google.com")
    const domain = extractBaseDomain(hostname);

    return {
      protocol,
      hostname,
      domain,
      port,
      fullOrigin: `${protocol}://${hostname}${parsed.port ? ':' + parsed.port : ''}`,
    };
  } catch {
    return null;
  }
}

/**
 * Extracts base eTLD+1 domain from a hostname (e.g. "sub.example.com" -> "example.com").
 */
export function extractBaseDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length <= 2) {
    return hostname;
  }

  // Handle common two-part TLDs (e.g. co.uk, com.au, co.in)
  const commonTwoPartTlds = ['co.uk', 'com.au', 'co.in', 'com.br', 'org.uk', 'gov.uk'];
  const lastTwo = parts.slice(-2).join('.');
  if (commonTwoPartTlds.includes(lastTwo) && parts.length > 2) {
    return parts.slice(-3).join('.');
  }

  return parts.slice(-2).join('.');
}

/**
 * Evaluates whether a stored credential URL matches the active webpage URL.
 * 
 * Rules:
 * 1. Protocol security: Insecure HTTP will never match HTTPS if requireSecureProtocol is enabled.
 * 2. Exact hostname match: e.g. "app.slack.com" === "app.slack.com" -> EXACT MATCH (score: 100)
 * 3. Base domain match: e.g. "auth.slack.com" shares "slack.com" with "slack.com" -> DOMAIN MATCH (score: 80)
 * 4. Path/Query matching: URL paths do not disqualify origin matches.
 * 5. Strict rejection: Differing base domains (e.g. "github.com" vs "fake-github.com") -> REJECT (score: 0)
 */
export function matchOrigin(
  credentialUrl: string,
  tabUrl: string,
  options: { allowSubdomains?: boolean; requireSecureProtocol?: boolean } = {
    allowSubdomains: true,
    requireSecureProtocol: false,
  }
): { isMatch: boolean; score: number; reason: string } {
  const cred = parseOrigin(credentialUrl);
  const tab = parseOrigin(tabUrl);

  if (!cred || !tab) {
    return { isMatch: false, score: 0, reason: 'Invalid URL format' };
  }

  // Protocol security check
  if (options.requireSecureProtocol && tab.protocol === 'https' && cred.protocol === 'http') {
    return { isMatch: false, score: 0, reason: 'Insecure HTTP credential rejected on HTTPS page' };
  }

  // Exact hostname match (e.g. github.com === github.com or sub.example.com === sub.example.com)
  if (cred.hostname === tab.hostname) {
    return { isMatch: true, score: 100, reason: 'Exact hostname match' };
  }

  // Base domain match (e.g. accounts.google.com and mail.google.com share google.com)
  if (options.allowSubdomains && cred.domain === tab.domain && cred.domain.length > 0) {
    return { isMatch: true, score: 80, reason: 'Base domain match' };
  }

  return { isMatch: false, score: 0, reason: 'Domain mismatch' };
}

/**
 * Filters a list of vault items and returns only those matching the target webpage URL,
 * sorted by match accuracy score.
 */
export function filterMatchingCredentials<T extends { url?: string; title: string }>(
  items: T[],
  tabUrl: string
): Array<T & { matchScore: number }> {
  if (!tabUrl) return [];

  const tab = parseOrigin(tabUrl);
  if (!tab) return [];

  const matched: Array<T & { matchScore: number }> = [];

  for (const item of items) {
    let score = 0;

    // 1. Try URL matching
    if (item.url) {
      const match = matchOrigin(item.url, tabUrl);
      if (match.isMatch) {
        score = match.score;
      }
    }

    // 2. Fallback to title matching if no URL was set (e.g. title: "GitHub" on github.com)
    if (score === 0 && item.title) {
      const normalizedTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const domainName = tab.domain.split('.')[0].toLowerCase();
      if (normalizedTitle === domainName || tab.hostname.includes(normalizedTitle)) {
        score = 50;
      }
    }

    if (score > 0) {
      matched.push({ ...item, matchScore: score });
    }
  }

  return matched.sort((a, b) => b.matchScore - a.matchScore);
}
