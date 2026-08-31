import { UnencryptedVaultItem } from './types';
import { calculatePasswordStrength } from './generator';

export interface AuditItemSummary {
  id?: string;
  title: string;
  username?: string;
  reason: string;
  score?: number;
  ageDays?: number;
}

export interface ReusedGroup {
  passwordSample: string;
  count: number;
  items: { id?: string; title: string; username?: string }[];
}

export interface SecurityAuditReport {
  overallScore: number; // 0 to 100
  healthGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  totalLogins: number;
  strongCount: number;
  weakItems: AuditItemSummary[];
  reusedGroups: ReusedGroup[];
  oldItems: AuditItemSummary[];
  missingTotpItems: AuditItemSummary[];
  recommendations: string[];
}

/**
 * Calculates a complete security audit locally over decrypted vault items.
 * Strictly zero-knowledge: credentials are NEVER transmitted to any server.
 */
export function analyzeVaultSecurity(
  items: UnencryptedVaultItem[],
  currentDateEpochMs: number = Date.now()
): SecurityAuditReport {
  const loginItems = items.filter((item) => item.type === 'login' && item.password);
  
  if (loginItems.length === 0) {
    return {
      overallScore: 100,
      healthGrade: 'A+',
      totalLogins: 0,
      strongCount: 0,
      weakItems: [],
      reusedGroups: [],
      oldItems: [],
      missingTotpItems: [],
      recommendations: ['Add login credentials to your vault to monitor password health.'],
    };
  }

  const weakItems: AuditItemSummary[] = [];
  const oldItems: AuditItemSummary[] = [];
  const missingTotpItems: AuditItemSummary[] = [];
  const passwordMap = new Map<string, { id?: string; title: string; username?: string }[]>();

  let totalStrengthScore = 0;
  let strongCount = 0;

  for (const item of loginItems) {
    const pwd = item.password || '';
    const strength = calculatePasswordStrength(pwd);
    totalStrengthScore += strength.score;

    if (strength.score >= 70) {
      strongCount++;
    } else {
      weakItems.push({
        id: item.id,
        title: item.title,
        username: item.username,
        reason: strength.label + ' strength (' + strength.score + '/100)',
        score: strength.score,
      });
    }

    // Track duplicates / reused passwords
    if (pwd) {
      const existing = passwordMap.get(pwd) || [];
      existing.push({ id: item.id, title: item.title, username: item.username });
      passwordMap.set(pwd, existing);
    }

    // Check age (default threshold 90 days)
    if (item.createdAt) {
      const createdMs = new Date(item.createdAt).getTime();
      if (!isNaN(createdMs)) {
        const ageDays = Math.floor((currentDateEpochMs - createdMs) / (1000 * 60 * 60 * 24));
        if (ageDays >= 90) {
          oldItems.push({
            id: item.id,
            title: item.title,
            username: item.username,
            reason: `Password is ${ageDays} days old (>90 days)`,
            ageDays,
          });
        }
      }
    }

    // Check TOTP 2FA presence
    if (!item.totpSecret) {
      missingTotpItems.push({
        id: item.id,
        title: item.title,
        username: item.username,
        reason: 'Two-factor authentication (TOTP) not configured',
      });
    }
  }

  // Find reused groups (passwords used by 2 or more accounts)
  const reusedGroups: ReusedGroup[] = [];
  let totalReusedAccountsCount = 0;

  passwordMap.forEach((groupItems, pwd) => {
    if (groupItems.length > 1) {
      totalReusedAccountsCount += groupItems.length;
      reusedGroups.push({
        passwordSample: pwd.length > 4 ? pwd.slice(0, 2) + '••••' : '••••',
        count: groupItems.length,
        items: groupItems,
      });
    }
  });

  // Calculate Overall Security Score
  // Base: Average Strength (45%)
  const avgStrength = totalStrengthScore / loginItems.length;

  // Penalties
  const reusedPenalty = Math.min(30, (totalReusedAccountsCount / loginItems.length) * 30);
  const weakPenalty = Math.min(25, (weakItems.length / loginItems.length) * 25);
  const oldPenalty = Math.min(10, (oldItems.length / loginItems.length) * 10);
  
  // Bonus: TOTP Coverage (up to +10%)
  const totpRatio = (loginItems.length - missingTotpItems.length) / loginItems.length;
  const totpBonus = Math.round(totpRatio * 10);

  let rawScore = (avgStrength * 0.55) - (reusedPenalty + weakPenalty + oldPenalty) + totpBonus + 35;
  let overallScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Calculate Grade
  let healthGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
  if (overallScore >= 95) healthGrade = 'A+';
  else if (overallScore >= 85) healthGrade = 'A';
  else if (overallScore >= 70) healthGrade = 'B';
  else if (overallScore >= 55) healthGrade = 'C';
  else if (overallScore >= 40) healthGrade = 'D';

  // Build actionable recommendations
  const recommendations: string[] = [];
  if (reusedGroups.length > 0) {
    recommendations.push(`Change ${totalReusedAccountsCount} credentials that reuse identical passwords.`);
  }
  if (weakItems.length > 0) {
    recommendations.push(`Upgrade ${weakItems.length} weak passwords using the Password Generator.`);
  }
  if (oldItems.length > 0) {
    recommendations.push(`Rotate ${oldItems.length} passwords older than 90 days.`);
  }
  if (missingTotpItems.length > 0) {
    recommendations.push(`Enable TOTP 2FA authenticator codes for ${missingTotpItems.length} accounts.`);
  }
  if (recommendations.length === 0) {
    recommendations.push('Outstanding! All vault credentials meet peak security standards.');
  }

  return {
    overallScore,
    healthGrade,
    totalLogins: loginItems.length,
    strongCount,
    weakItems,
    reusedGroups,
    oldItems,
    missingTotpItems,
    recommendations,
  };
}
