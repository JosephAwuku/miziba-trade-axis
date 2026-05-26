import { verifySync } from 'otplib';

/** Verify a 6-digit TOTP code against the user's stored secret. */
export function verifyTotpCode(token: string, secret: string): boolean {
  const result = verifySync({
    token: String(token),
    secret,
    strategy: 'totp',
  });
  return result.valid === true;
}
