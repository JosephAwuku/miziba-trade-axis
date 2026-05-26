"use client";

import React, { useState } from 'react';
import { Role } from '@/lib/types';
import { apiClient } from '@/lib/api';

export type LoginResult =
  | { next_step: 'DONE'; token: string; expires_at?: string; user: any }
  | { next_step: 'PASSWORD_CHANGE_REQUIRED'; onboarding_token: string; user: any }
  | { next_step: 'MFA_SETUP_REQUIRED'; onboarding_token: string; user: any }
  | { next_step: 'MFA_CODE_REQUIRED'; user: any };

interface LoginProps {
  onLoginSuccess: (user: any, role: Role, token?: string, expiresAt?: string) => void;
  onOnboarding: (result: LoginResult) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onOnboarding }) => {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [requiresMfaCode, setRequiresMfaCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setError(null);

    const newErrors: Record<string, string> = {};
    if (!email) newErrors.email = 'Email address is required.';
    if (!password) newErrors.password = 'Password is required.';
    if (requiresMfaCode && !totpCode) newErrors.totp = 'Authenticator code is required.';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setLoading(true);
    try {
      const result = await apiClient.login(email, password, totpCode || undefined) as any;

      if (result.next_step === 'DONE') {
        apiClient.setToken(result.token);
        onLoginSuccess(result.user, result.user.role as Role, result.token, result.expires_at);
        return;
      }

      if (result.next_step === 'MFA_CODE_REQUIRED') {
        // Password correct, enrolled MFA present — move to OTP screen
        setRequiresMfaCode(true);
        setStep('otp');
        setError('Enter the 6-digit code from your authenticator app.');
        return;
      }

      // Any onboarding state — hand off to SecuritySetup screen
      onOnboarding(result as LoginResult);

    } catch (err: any) {
      const msg: string = err.message || '';
      if (msg.toLowerCase().includes('account locked')) {
        setError(msg);
      } else if (msg.toLowerCase().includes('invalid totp') || msg.toLowerCase().includes('incorrect totp')) {
        setError(msg);
        setErrors({ totp: ' ' });
      } else if (msg.toLowerCase().includes('invalid credentials') || msg.toLowerCase().includes('unauthorized')) {
        setError(requiresMfaCode ? msg : 'Invalid email or password.');
        setErrors(requiresMfaCode ? { totp: ' ' } : { email: ' ', password: ' ' });
      } else {
        setError(msg || 'Authentication failed. Please contact support.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F9F5F2',
      fontFamily: 'var(--font-work-sans)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '500px',
        padding: '40px',
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 24px 48px -12px rgba(139, 0, 0, 0.14), 0 12px 24px -8px rgba(124, 58, 237, 0.1)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '60px', height: '60px',
            background: 'linear-gradient(135deg, #8B0000 0%, #C41E3A 100%)',
            borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '32px', fontWeight: 800, margin: '0 auto 16px',
            boxShadow: '0 10px 20px -5px rgba(139, 0, 0, 0.4)',
          }}>T</div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', marginBottom: '8px', letterSpacing: '-0.02em' }}>TradeAxis</h1>
          <p style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>
            {step === 'otp' ? 'Step 2 of 2: Verify your identity' : 'Manage your trade operations in one place'}
          </p>
        </div>

        {error && !Object.values(errors).some(v => v.length > 1) && (
          <div style={{
            padding: '12px', background: '#FEF2F2', border: '1px solid #FEE2E2',
            borderRadius: '8px', color: '#DC2626', fontSize: '13px', marginBottom: '20px',
            textAlign: 'center', fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} noValidate>
          {step === 'credentials' && (
            <>
              <div style={{ marginBottom: errors.email ? '12px' : '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: '' }); }}
                  className={errors.email ? 'err' : ''}
                  style={{ width: '100%', transition: 'all 0.2s' }}
                />
                {errors.email && errors.email.length > 1 && <div className="field-error">{errors.email}</div>}
              </div>

              <div style={{ marginBottom: errors.password ? '16px' : '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: '' }); }}
                    className={errors.password ? 'err' : ''}
                    style={{ width: '100%', transition: 'all 0.2s', paddingRight: '90px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'none',
                      color: '#6B7280',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {errors.password && errors.password.length > 1 && <div className="field-error">{errors.password}</div>}
              </div>
            </>
          )}

          {step === 'otp' && requiresMfaCode && (
            <div style={{ marginBottom: errors.totp ? '16px' : '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                Authenticator Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={totpCode}
                onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setTotpCode(v); if (errors.totp) setErrors({ ...errors, totp: '' }); }}
                className={errors.totp ? 'err' : ''}
                style={{ width: '100%', letterSpacing: '0.2em' }}
                autoFocus
              />
              {errors.totp && errors.totp.length > 1 && <div className="field-error">{errors.totp}</div>}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px', background: '#8B0000', color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 700,
              cursor: 'pointer', transition: 'background 0.2s', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in...' : step === 'otp' ? 'Verify & Sign In' : 'Continue'}
          </button>

          {step === 'otp' && requiresMfaCode && (
            <button
              type="button"
              onClick={() => {
                setRequiresMfaCode(false);
                setStep('credentials');
                setTotpCode('');
                setError(null);
                setErrors({});
              }}
              style={{ width: '100%', marginTop: '10px', background: 'none', border: 'none', color: '#6B7280', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
            >
              ← Use a different account
            </button>
          )}
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#9CA3AF' }}>Protected by TradeAxis Secure Gateway</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
