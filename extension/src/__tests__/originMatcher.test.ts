import { describe, it, expect } from 'vitest';
import {
  parseOrigin,
  extractBaseDomain,
  matchOrigin,
  filterMatchingCredentials,
} from '../lib/originMatcher';

describe('panda.vault Browser Extension Origin Matcher & Phishing Defense', () => {
  it('should accurately parse and extract hostnames and base domains', () => {
    const res = parseOrigin('https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn');
    expect(res).not.toBeNull();
    expect(res?.protocol).toBe('https');
    expect(res?.hostname).toBe('accounts.google.com');
    expect(res?.domain).toBe('google.com');
  });

  it('should handle two-part TLDs (e.g. co.uk, com.au)', () => {
    expect(extractBaseDomain('amazon.co.uk')).toBe('amazon.co.uk');
    expect(extractBaseDomain('login.amazon.co.uk')).toBe('amazon.co.uk');
    expect(extractBaseDomain('sub.bank.com.au')).toBe('bank.com.au');
  });

  it('should accurately score exact hostname matches (100 score)', () => {
    const res = matchOrigin('https://github.com/login', 'https://github.com/session');
    expect(res.isMatch).toBe(true);
    expect(res.score).toBe(100);
  });

  it('should accurately score base domain subdomain matches (80 score)', () => {
    const res = matchOrigin('https://slack.com', 'https://app.slack.com/client');
    expect(res.isMatch).toBe(true);
    expect(res.score).toBe(80);
  });

  it('should REJECT phishing attempts with prepended or hyphenated domains (0 score)', () => {
    const res1 = matchOrigin('https://github.com', 'https://github.com.evil.com');
    expect(res1.isMatch).toBe(false);
    expect(res1.score).toBe(0);

    const res2 = matchOrigin('https://paypal.com', 'https://paypal-security-update.com');
    expect(res2.isMatch).toBe(false);
    expect(res2.score).toBe(0);

    const res3 = matchOrigin('https://google.com', 'https://g00gle.com');
    expect(res3.isMatch).toBe(false);
  });

  it('should filter matching credentials and order by highest match score', () => {
    const items = [
      { id: '1', title: 'GitHub Work', url: 'https://github.com/enterprise', username: 'work_user' },
      { id: '2', title: 'Google Mail', url: 'https://mail.google.com', username: 'me@gmail.com' },
      { id: '3', title: 'GitHub Personal', url: 'https://github.com/personal', username: 'personal_user' },
      { id: '4', title: 'AWS Console', url: 'https://console.aws.amazon.com', username: 'aws_admin' },
    ];

    const matched = filterMatchingCredentials(items, 'https://github.com/login');
    expect(matched.length).toBe(2);
    expect(matched[0].url).toContain('github.com');
    expect(matched[1].url).toContain('github.com');
    expect(matched.find((m) => m.id === '2')).toBeUndefined();
    expect(matched.find((m) => m.id === '4')).toBeUndefined();
  });

  it('should fall back to title matching when URL is missing', () => {
    const items = [
      { id: '1', title: 'Netflix', username: 'user@netflix.com' },
      { id: '2', title: 'Spotify', username: 'user@spotify.com' },
    ];

    const matched = filterMatchingCredentials(items, 'https://www.netflix.com/login');
    expect(matched.length).toBe(1);
    expect(matched[0].id).toBe('1');
    expect(matched[0].matchScore).toBe(50);
  });
});
