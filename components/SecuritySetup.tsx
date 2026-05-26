"use client";

import React, { useState, useEffect } from 'react';

interface SecuritySetupProps {
  step: 'PASSWORD_CHANGE_REQUIRED' | 'MFA_SETUP_REQUIRED' | 'MFA_CODE_REQUIRED';
  user: { id: string; email: string; full_name: string; role: string };
  onboardingToken: string;
  onComplete: (sessionToken: string, user: any, expiresAt?: string) => void;
}

// ─── STEP 1: Force password change ───────────────────────────────────────────

const PasswordChangeStep: React.FC<{
  user: SecuritySetupProps['user'];
  token: string;
  onNext: (nextStep: string, newToken: string) => void;
}> = ({ user, token, onNext }) => {
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPw.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Failed to change password.');
        return;
      }
      onNext(data.next_step, data.onboarding_token || data.token);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '22px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>
          Set Your Password
        </div>
        <p style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.5 }}>
          You've been assigned a temporary password. Create a permanent one before continuing.
        </p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '8px', color: '#DC2626', fontSize: '13px', marginBottom: '20px', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
            New Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="Min. 12 characters"
              style={{ width: '100%', paddingRight: '44px' }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPw(p => !p)}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '12px', fontWeight: 700 }}
            >
              {showPw ? 'HIDE' : 'SHOW'}
            </button>
          </div>
          <div style={{ marginTop: '4px', fontSize: '11px', color: newPw.length >= 12 ? '#059669' : '#9CA3AF' }}>
            {newPw.length >= 12 ? '✓ Strong enough' : `${12 - newPw.length} more characters needed`}
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
            Confirm Password
          </label>
          <input
            type={showPw ? 'text' : 'password'}
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            placeholder="Re-enter password"
            style={{ width: '100%', borderColor: confirmPw && confirmPw !== newPw ? '#EF4444' : undefined }}
          />
          {confirmPw && confirmPw !== newPw && (
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#EF4444' }}>Passwords do not match</div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || newPw.length < 12 || newPw !== confirmPw}
          style={{
            width: '100%', padding: '14px', background: '#8B0000', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 700,
            cursor: 'pointer', opacity: (loading || newPw.length < 12 || newPw !== confirmPw) ? 0.6 : 1,
          }}
        >
          {loading ? 'Saving...' : 'Set Password & Continue'}
        </button>
      </form>
    </div>
  );
};

// ─── STEP 2: Self-service OTP enrollment ─────────────────────────────────────

const MfaSetupStep: React.FC<{
  user: SecuritySetupProps['user'];
  token: string;
  onComplete: (sessionToken: string, user: any, expiresAt?: string) => void;
}> = ({ user, token, onComplete }) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    startSetup();
  }, []);

  const startSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Failed to generate QR code.');
        return;
      }
      setQrCode(data.qr_code_data_url);
      setOtpauthUrl(data.otpauth_url);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6) return;
    setVerifying(true);
    setError('');
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ totp_code: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Invalid code. Try again.');
        setTotpCode('');
        return;
      }
      // Verification complete — hand off full session
      onComplete(data.token, data.user, data.expires_at);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '22px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>
          Secure Your Account
        </div>
        <p style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.5 }}>
          Two-factor authentication is required. Scan the QR code with an authenticator app
          (Google Authenticator, Authy, etc.) and enter the 6-digit code below.
        </p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '8px', color: '#DC2626', fontSize: '13px', marginBottom: '20px', fontWeight: 600 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>Generating QR code...</div>
      )}

      {qrCode && !loading && (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div style={{ padding: '12px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <img src={qrCode} alt="Authenticator QR code" style={{ width: 'min(180px, 52vw)', height: 'min(180px, 52vw)', display: 'block' }} />
            </div>
          </div>

          <form onSubmit={handleVerify}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
              Enter 6-digit code from your app
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={totpCode}
              onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              style={{ width: '100%', letterSpacing: '0.3em', fontSize: '20px', textAlign: 'center', marginBottom: '20px' }}
              autoFocus
            />
            <button
              type="submit"
              disabled={verifying || totpCode.length !== 6}
              style={{
                width: '100%', padding: '14px', background: '#8B0000', color: '#fff',
                border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 700,
                cursor: 'pointer', opacity: (verifying || totpCode.length !== 6) ? 0.6 : 1,
              }}
            >
              {verifying ? 'Verifying...' : 'Activate 2FA & Enter TradeAxis'}
            </button>
          </form>
        </>
      )}
    </div>
  );
};

// ─── STEP 3: Login with existing OTP ─────────────────────────────────────────

const MfaCodeStep: React.FC<{
  user: SecuritySetupProps['user'];
  onSubmit: (code: string) => void;
  loading: boolean;
  error: string;
}> = ({ user, onSubmit, loading, error }) => {
  const [code, setCode] = useState('');

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '22px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>
          Two-Factor Authentication
        </div>
        <p style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.5 }}>
          Enter the 6-digit code from your authenticator app to continue.
        </p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '8px', color: '#DC2626', fontSize: '13px', marginBottom: '20px', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); onSubmit(code); }}>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456"
          style={{ width: '100%', letterSpacing: '0.3em', fontSize: '20px', textAlign: 'center', marginBottom: '20px' }}
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || code.length !== 6}
          style={{
            width: '100%', padding: '14px', background: '#8B0000', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 700,
            cursor: 'pointer', opacity: (loading || code.length !== 6) ? 0.6 : 1,
          }}
        >
          {loading ? 'Verifying...' : 'Verify & Sign In'}
        </button>
      </form>
    </div>
  );
};

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────

const SecuritySetup: React.FC<SecuritySetupProps> = ({ step: initialStep, user, onboardingToken, onComplete }) => {
  const [step, setStep] = useState(initialStep);
  const [token, setToken] = useState(onboardingToken);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');

  const handlePasswordChanged = (nextStep: string, newToken: string) => {
    setToken(newToken);
    setStep(nextStep as any);
  };

  const handleMfaCode = async (code: string) => {
    setMfaLoading(true);
    setMfaError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: '', totp_code: code }),
      });
      // For the MFA_CODE_REQUIRED step we post just the totp directly to /auth/2fa/verify
      // using the onboarding token as auth (which is actually a full session token at this point)
      const verifyRes = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ totp_code: code }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) {
        setMfaError(data.message || 'Invalid code. Try again.');
        return;
      }
      onComplete(data.token, data.user, data.expires_at);
    } catch {
      setMfaError('Network error. Please try again.');
    } finally {
      setMfaLoading(false);
    }
  };

  const stepNumber = step === 'PASSWORD_CHANGE_REQUIRED' ? 1 : step === 'MFA_SETUP_REQUIRED' ? 2 : 2;
  const totalSteps = initialStep === 'PASSWORD_CHANGE_REQUIRED' ? 2 : 1;

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: '#F9F5F2',
      fontFamily: 'var(--font-work-sans)',
    }}>
      <div style={{
        width: 'min(100%, 480px)',
        maxWidth: '480px',
        maxHeight: 'calc(100dvh - 32px)',
        overflowY: 'auto',
        padding: 'clamp(20px, 4vw, 40px)',
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 24px 48px -12px rgba(139, 0, 0, 0.14), 0 12px 24px -8px rgba(124, 58, 237, 0.1)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #8B0000, #C41E3A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '24px', fontWeight: 800, margin: '0 auto 12px',
          }}>T</div>

          {/* Step progress dots */}
          {totalSteps > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: i < stepNumber ? '#8B0000' : '#E5E7EB',
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>
          )}

          <p style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 600 }}>
            Account Security Setup · {user.email}
          </p>
        </div>

        {step === 'PASSWORD_CHANGE_REQUIRED' && (
          <PasswordChangeStep user={user} token={token} onNext={handlePasswordChanged} />
        )}
        {step === 'MFA_SETUP_REQUIRED' && (
          <MfaSetupStep user={user} token={token} onComplete={onComplete} />
        )}
        {step === 'MFA_CODE_REQUIRED' && (
          <MfaCodeStep user={user} onSubmit={handleMfaCode} loading={mfaLoading} error={mfaError} />
        )}
      </div>
    </div>
  );
};

export default SecuritySetup;
