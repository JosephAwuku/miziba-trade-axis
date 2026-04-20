"use client";

import React, { useState } from 'react';
import { Button, Card } from '../ui';
import { apiClient } from '@/lib/api';

interface UserInviteProps {
  onNotify: (msg: string, type?: string) => void;
  onSuccess?: () => void;
}

const UserInvite: React.FC<UserInviteProps> = ({ onNotify, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    org_name: '',
    role: 'trader',
    temp_password: ''
  });

  const roles = [
    { id: 'trader', label: 'Trader / Exporter', desc: 'Can submit applications and business verification' },
    { id: 'finance_partner', label: 'Finance Partner', desc: 'Can approve facilities and monitor deal portfolios' },
    { id: 'deal_officer', label: 'Deal Officer', desc: 'Internal staff: Pipeline and risk management' },
    { id: 'cfo', label: 'CFO / Authorization', desc: 'Internal staff: Final authorizations and settlement' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Full name is required for account provisioning.';
    if (!formData.email.trim()) {
      newErrors.email = 'A valid login email is required.';
    } else if (!formData.email.includes('@')) {
      newErrors.email = 'Please enter a valid email address.';
    }
    if (!formData.org_name.trim()) newErrors.org_name = 'Organization name must be provided.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      onNotify('Verification failed. Please check the marked fields.', 'error');
      return;
    }

    setLoading(true);
    try {
      await apiClient.inviteTrader(formData); // This calls the universal invite route
      onNotify(`Account created for ${formData.email} as ${formData.role.replace('_', ' ')}!`, 'success');
      setFormData({ name: '', email: '', org_name: '', role: 'trader', temp_password: '' });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      onNotify(err.message || 'Failed to create user.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
        <form onSubmit={handleSubmit} style={{ padding: '0 10px' }} noValidate>
          
          <div style={{ marginBottom: '40px' }}>
            <label style={{ display: 'block', marginBottom: '16px', fontWeight: 800, fontSize: '16px' }}>Account Role & Access Level</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {roles.map(r => (
                <div 
                  key={r.id}
                  onClick={() => setFormData({ ...formData, role: r.id })}
                  style={{ 
                    padding: '20px', 
                    borderRadius: '16px', 
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    backgroundImage: `linear-gradient(${formData.role === r.id ? '#FFF9F9' : '#fff'}, ${formData.role === r.id ? '#FFF9F9' : '#fff'}), linear-gradient(135deg, var(--cr), var(--pu))`,
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box',
                    boxShadow: formData.role === r.id ? '0 4px 12px rgba(139, 0, 0, 0.08)' : '0 1px 3px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s',
                    position: 'relative',
                    opacity: formData.role === r.id ? 1 : 0.7
                  }}
                >
                  <div style={{ fontWeight: 800, color: formData.role === r.id ? 'var(--cr)' : 'var(--text)', fontSize: '15px' }}>{r.label}</div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', lineHeight: 1.4 }}>{r.desc}</div>
                  
                  {formData.role === r.id && (
                    <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                       <div style={{ background: 'var(--cr)', borderRadius: '50%', width: '12px', height: '12px' }}></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="g2" style={{ gap: '32px', marginBottom: '24px' }}>
            <div className="field">
              <label>Full Name <span style={{ color: 'var(--cr)' }}>*</span></label>
              <input 
                type="text" 
                placeholder="e.g. Muazu Abubakar" 
                value={formData.name}
                onChange={e => {
                   setFormData({ ...formData, name: e.target.value });
                   if (errors.name) setErrors({ ...errors, name: '' });
                }}
                className={errors.name ? 'err' : ''}
              />
              {errors.name && <div className="field-error">{errors.name}</div>}
            </div>
            <div className="field">
              <label>Login Email <span style={{ color: 'var(--cr)' }}>*</span></label>
              <input 
                type="email" 
                placeholder="user@example.com" 
                value={formData.email}
                onChange={e => {
                   setFormData({ ...formData, email: e.target.value });
                   if (errors.email) setErrors({ ...errors, email: '' });
                }}
                className={errors.email ? 'err' : ''}
              />
              {errors.email && <div className="field-error">{errors.email}</div>}
            </div>
          </div>

          <div className="field" style={{ marginBottom: '24px' }}>
            <label>Organization / Entity Name <span style={{ color: 'var(--cr)' }}>*</span></label>
            <input 
              type="text" 
              placeholder="e.g. Miziba Strategic / Trader Co" 
              value={formData.org_name}
              onChange={e => {
                 setFormData({ ...formData, org_name: e.target.value });
                 if (errors.org_name) setErrors({ ...errors, org_name: '' });
              }}
              className={errors.org_name ? 'err' : ''}
            />
            {errors.org_name && <div className="field-error">{errors.org_name}</div>}
          </div>

          <div className="field" style={{ marginBottom: '32px' }}>
            <label>Temporary Password (Optional)</label>
            <input 
              type="text" 
              placeholder="Will default to 'Welcome123!' if empty" 
              value={formData.temp_password}
              onChange={e => setFormData({ ...formData, temp_password: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid #F3F4F6', paddingTop: '32px' }}>
            <Button type="submit" disabled={loading} style={{ flex: 1, height: '54px', fontSize: '16px' }}>
              {loading ? 'Creating Account...' : 'Provision User Account'}
            </Button>
            <Button 
                type="button" 
                variant="secondary" 
                onClick={() => setFormData({ name: '', email: '', org_name: '', role: 'trader', temp_password: '' })}
                disabled={loading}
                style={{ height: '54px' }}
            >
              Reset
            </Button>
          </div>
        </form>
    </div>
  );
};

export default UserInvite;
