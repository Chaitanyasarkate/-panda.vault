import { describe, it, expect } from 'vitest';
import { analyzeVaultSecurity, SecurityAuditReport } from '../securityAudit';
import { UnencryptedVaultItem } from '../types';

describe('VaultX Local Security Audit Analysis Algorithms', () => {
  it('should return a perfect score for an empty vault', () => {
    const report = analyzeVaultSecurity([]);
    expect(report.overallScore).toBe(100);
    expect(report.healthGrade).toBe('A+');
    expect(report.totalLogins).toBe(0);
    expect(report.weakItems).toHaveLength(0);
    expect(report.reusedGroups).toHaveLength(0);
  });

  it('should detect weak passwords accurately', () => {
    const items: UnencryptedVaultItem[] = [
      {
        id: '1',
        type: 'login',
        title: 'Weak Account 1',
        username: 'user1',
        password: '123', // Very weak (< 6 chars)
      },
      {
        id: '2',
        type: 'login',
        title: 'Weak Account 2',
        username: 'user2',
        password: 'password', // Common dictionary weak
      },
      {
        id: '3',
        type: 'login',
        title: 'Strong Account',
        username: 'user3',
        password: 'K9#mQ$8xL!2vP@5zW&7tR*4b', // 24-char high entropy
      },
    ];

    const report = analyzeVaultSecurity(items);
    expect(report.totalLogins).toBe(3);
    expect(report.weakItems).toHaveLength(2);
    expect(report.weakItems.map((w) => w.id)).toContain('1');
    expect(report.weakItems.map((w) => w.id)).toContain('2');
    expect(report.strongCount).toBe(1);
  });

  it('should detect reused passwords and group accounts accordingly', () => {
    const items: UnencryptedVaultItem[] = [
      {
        id: '10',
        type: 'login',
        title: 'Email 1',
        username: 'alice@mail.com',
        password: 'SharedSecretPassword123!', // Reused across 3 accounts
      },
      {
        id: '20',
        type: 'login',
        title: 'Email 2',
        username: 'alice@work.com',
        password: 'SharedSecretPassword123!',
      },
      {
        id: '30',
        type: 'login',
        title: 'Banking App',
        username: 'alice_bank',
        password: 'SharedSecretPassword123!',
      },
      {
        id: '40',
        type: 'login',
        title: 'Unique Account',
        username: 'alice_unique',
        password: 'Z9#xP$1wM!8kL@3vB&5tY*7q',
      },
    ];

    const report = analyzeVaultSecurity(items);
    expect(report.reusedGroups).toHaveLength(1);
    expect(report.reusedGroups[0].count).toBe(3);
    expect(report.reusedGroups[0].items.map((i) => i.id)).toEqual(['10', '20', '30']);
  });

  it('should detect passwords older than 90 days', () => {
    const now = Date.now();
    const hundredDaysAgo = new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();

    const items: UnencryptedVaultItem[] = [
      {
        id: 'old-1',
        type: 'login',
        title: 'Legacy Server',
        password: 'StrongLegacyPassword!123',
        createdAt: hundredDaysAgo,
      },
      {
        id: 'new-1',
        type: 'login',
        title: 'Recent App',
        password: 'FreshPassword!456',
        createdAt: tenDaysAgo,
      },
    ];

    const report = analyzeVaultSecurity(items, now);
    expect(report.oldItems).toHaveLength(1);
    expect(report.oldItems[0].id).toBe('old-1');
    expect(report.oldItems[0].ageDays).toBeGreaterThanOrEqual(99);
  });

  it('should track accounts missing TOTP two-factor authentication', () => {
    const items: UnencryptedVaultItem[] = [
      {
        id: 'with-2fa',
        type: 'login',
        title: 'GitHub',
        password: 'SecurePassword123!',
        totpSecret: 'JBSWY3DPEHPK3PXP',
      },
      {
        id: 'without-2fa',
        type: 'login',
        title: 'Social Network',
        password: 'SecurePassword456!',
      },
    ];

    const report = analyzeVaultSecurity(items);
    expect(report.missingTotpItems).toHaveLength(1);
    expect(report.missingTotpItems[0].id).toBe('without-2fa');
  });

  it('should calculate comprehensive overall score and grade accurately', () => {
    // 1. Pristine vault: All strong passwords + 2FA configured
    const pristineItems: UnencryptedVaultItem[] = [
      {
        id: 'p1',
        type: 'login',
        title: 'Account 1',
        password: 'K9#mQ$8xL!2vP@5zW&7tR*4b',
        totpSecret: 'JBSWY3DPEHPK3PXP',
      },
      {
        id: 'p2',
        type: 'login',
        title: 'Account 2',
        password: 'Z9#xP$1wM!8kL@3vB&5tY*7q',
        totpSecret: 'GEZDGNBVGY3TQOJQ',
      },
    ];
    const pristineReport = analyzeVaultSecurity(pristineItems);
    expect(pristineReport.overallScore).toBeGreaterThanOrEqual(90);
    expect(['A+', 'A']).toContain(pristineReport.healthGrade);

    // 2. Compromised / High Risk vault: Reused weak passwords
    const riskyItems: UnencryptedVaultItem[] = [
      {
        id: 'r1',
        type: 'login',
        title: 'Risk 1',
        password: '123',
      },
      {
        id: 'r2',
        type: 'login',
        title: 'Risk 2',
        password: '123',
      },
    ];
    const riskyReport = analyzeVaultSecurity(riskyItems);
    expect(riskyReport.overallScore).toBeLessThan(50);
    expect(['D', 'F']).toContain(riskyReport.healthGrade);
    expect(riskyReport.recommendations.length).toBeGreaterThan(0);
  });
});
