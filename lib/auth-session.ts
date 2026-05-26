/** Shared session length for JWTs and response `expires_at` (aligns with `sessions` policy in DB). */

// Role-based session timeouts (in minutes)
const ROLE_SESSION_TIMEOUTS: Record<string, number> = {
  ceo: 120,              // 2 hours - high security role
  cfo: 120,              // 2 hours - high security role  
  ops_admin: 180,        // 3 hours - operational role
  deal_officer: 180,     // 3 hours - operational role
  finance_partner: 240,  // 4 hours - reviewing role
  trader: 240,           // 4 hours - submission role
};

export function getSessionExpiryMinutes(role?: string): number {
  const envValue = parseInt(process.env.SESSION_EXPIRY_MINUTES || '120', 10);
  
  // If role provided and has custom timeout, use it
  if (role && ROLE_SESSION_TIMEOUTS[role]) {
    const roleTimeout = ROLE_SESSION_TIMEOUTS[role];
    return Math.max(15, Math.min(24 * 60, roleTimeout));
  }
  
  // Otherwise use env or default
  return Math.max(15, Math.min(24 * 60, Number.isFinite(envValue) ? envValue : 120));
}

export function sessionExpiresAtMs(role?: string): number {
  return Date.now() + getSessionExpiryMinutes(role) * 60 * 1000;
}
