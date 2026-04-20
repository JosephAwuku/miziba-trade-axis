"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Role } from '@/lib/types';
import { apiClient } from '@/lib/api';

interface LoginProps {
  onLoginSuccess: (user: any, role: Role) => void;
}

const TEST_EMAIL_MAP: Record<string, Role> = {
  'officer@miziba.com': 'deal_officer',
  'ceo@miziba.com': 'ceo',
  'cfo@miziba.com': 'cfo',
  'trader@miziba.com': 'trader',
  'partner@miziba.com': 'finance_partner',
  'admin@miziba.com': 'ops_admin'
};

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setError(null);

    // Local validation
    const newErrors: Record<string, string> = {};
    if (!email) newErrors.email = 'Email address is required.';
    if (!password) newErrors.password = 'Password is required.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      // Use the centralized API client for login
      const result = await apiClient.login(email, password);
      
      if (result && result.user) {
        // Persist the custom JWT token in the apiClient
        apiClient.setToken(result.token);
        
        // Pass success up to parent
        onLoginSuccess(result.user, result.user.role as Role);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const msg = err.message || '';
      if (msg.toLowerCase().includes('password')) {
        setErrors({ password: 'The password you entered is incorrect.' });
      } else if (msg.toLowerCase().includes('user') || msg.toLowerCase().includes('credential')) {
        setError('Invalid login credentials. Please try again.');
        setErrors({ email: ' ', password: ' ' }); // Highlight both
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
      background: 'linear-gradient(135deg, #0d1f3c 0%, #1b2b4d 100%)',
      fontFamily: 'var(--font-ibm-plex-sans)'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '400px', 
        padding: '40px', 
        background: '#fff', 
        borderRadius: '16px', 
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            width: '60px', 
            height: '60px', 
            background: 'linear-gradient(135deg, #8B0000 0%, #C41E3A 100%)', 
            borderRadius: '12px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: '#fff', 
            fontSize: '32px', 
            fontWeight: 800, 
            margin: '0 auto 16px',
            boxShadow: '0 10px 20px -5px rgba(139, 0, 0, 0.4)'
          }}>T</div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>TradeAxis</h1>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>Global Trade Finance Orchestration</p>
        </div>

        {error && !Object.values(errors).some(v => v.length > 1) && (
          <div style={{ 
            padding: '12px', 
            background: '#FEF2F2', 
            border: '1px solid #FEE2E2', 
            borderRadius: '8px', 
            color: '#DC2626', 
            fontSize: '13px', 
            marginBottom: '20px',
            textAlign: 'center',
            fontWeight: 600
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} noValidate>
          <div style={{ marginBottom: errors.email ? '12px' : '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>Email Address</label>
            <input 
              type="email" 
              placeholder="name@company.com" 
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
              className={errors.email ? 'err' : ''}
              style={{ 
                width: '100%', 
                padding: '12px', 
                border: '1px solid #D1D5DB', 
                borderRadius: '8px', 
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s'
              }}
            />
            {errors.email && errors.email.length > 1 && <div className="field-error">{errors.email}</div>}
          </div>
          <div style={{ marginBottom: errors.password ? '16px' : '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: '' });
              }}
              className={errors.password ? 'err' : ''}
              style={{ 
                width: '100%', 
                padding: '12px', 
                border: '1px solid #D1D5DB', 
                borderRadius: '8px', 
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s'
              }}
            />
            {errors.password && errors.password.length > 1 && <div className="field-error">{errors.password}</div>}
          </div>
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '14px', 
              background: '#8B0000', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '8px', 
              fontSize: '15px', 
              fontWeight: 700, 
              cursor: 'pointer',
              transition: 'background 0.2s',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#9CA3AF' }}>
            TradeAxis Security · Environment DEV-PRD
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
