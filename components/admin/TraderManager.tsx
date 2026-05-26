"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge } from '../ui';
import { apiClient } from '@/lib/api';

interface TraderManagerProps {
  traderId: string;
  onNotify: (msg: string, type?: string) => void;
  onBack: () => void;
}

const TraderManager: React.FC<TraderManagerProps> = ({ traderId, onNotify, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const organisationDocuments = data?.organisation_documents || [];

  useEffect(() => {
    const fetchTraderData = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getTraderProfileForAdmin(traderId); 
        setData(response);
      } catch (err: any) {
        onNotify('Failed to fetch trader management data.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchTraderData();
  }, [traderId]);

  if (loading) return (
    <div style={{ padding: '60px', textAlign: 'center' }}>
      <div className="animate-pulse" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--cr)', letterSpacing: '0.1em' }}>
        SYNCHRONIZING INSTITUTIONAL DATA...
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ padding: '60px', textAlign: 'center' }}>
        <p style={{ color: 'var(--cr)', fontWeight: 700, fontSize: '18px' }}>Critical Error: Failed to resolve institutional profile.</p>
        <p style={{ color: 'var(--text3)', fontSize: '14px', marginTop: '8px' }}>The organization record associated with this ID could not be found in the registry.</p>
    </div>
  );

  return (
    <div className="fade-in">
      {/* Institutional Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: '32px',
        padding: '24px',
        background: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.04em', color: '#111827' }}>
                {data.name}
            </h2>
            <Badge variant={data.kyc_status === 'VERIFIED' ? 'success' : 'warning'} style={{ height: 'fit-content' }}>
              {data.kyc_status}
            </Badge>
          </div>
          <p style={{ fontSize: '14px', color: '#6B7280', fontWeight: 500 }}>
            Universal Registry ID: <span className="mono" style={{ fontWeight: 700, color: 'var(--nv)' }}>{traderId}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
             <Button style={{ background: 'var(--cr)', color: 'white', fontWeight: 800, border: 'none', padding: '12px 24px' }}>Institutional Lock</Button>
        </div>
      </div>

      <div className="g2-responsive" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Corporate Profile Card */}
          <div style={{ 
            background: 'white',
            borderRadius: '16px',
            border: '2px solid transparent',
            backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, var(--cr), var(--pu))',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            padding: '28px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--nv)', marginBottom: '24px', letterSpacing: '0.05em' }}>CORPORATE INTELLIGENCE</h3>
            <div className="g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
               <div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 800, marginBottom: '6px' }}>Registration / Charter No</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>{data.registration_no || 'NOT DISCLOSED'}</div>
               </div>
               <div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 800, marginBottom: '6px' }}>Taxpayer ID (TIN)</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>{data.tin || 'NOT DISCLOSED'}</div>
               </div>
               <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 800, marginBottom: '6px' }}>Registered Business Address</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>{data.address || 'PENDING SUBMISSION'}</div>
               </div>
            </div>
          </div>

          {/* Settlement Card */}
          <div style={{ 
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #E5E7EB',
            padding: '28px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--nv)', marginBottom: '24px', letterSpacing: '0.05em' }}>SETTLEMENT & BANKING</h3>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #F1F5F9' }}>
                   <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Bank Name</div>
                   <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--cr)' }}>{data.traderProfile?.bank_name || 'UNDEFINED'}</div>
                </div>
                <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #F1F5F9' }}>
                   <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>SWIFT / BIC Code</div>
                   <div style={{ fontSize: '15px', fontWeight: 700, color: '#1E293B' }} className="mono">{data.traderProfile?.bank_swift || 'UNDEFINED'}</div>
                </div>
                <div style={{ gridColumn: 'span 2', padding: '16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #F1F5F9' }}>
                   <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Account Holder & Number</div>
                   <div style={{ fontSize: '15px', fontWeight: 700, color: '#1E293B' }}>
                    {data.traderProfile?.bank_account_name || 'UNSPECIFIED'} · <span className="mono">{data.traderProfile?.bank_account_number || '••••••••'}</span>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Right Sidebar: Compliance Vault */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ 
            background: 'white',
            borderRadius: '16px',
            border: '2px solid transparent',
            backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, var(--cr), var(--pu))',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            padding: '24px'
          }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--nv)', letterSpacing: '0.05em' }}>COMPLIANCE VAULT</h3>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--cr)' }}>SECURE ACCESS</span>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#F1F5F9', border: '1px solid #F1F5F9', borderRadius: '12px', overflow: 'hidden' }}>
                {organisationDocuments.length === 0 && (
                  <div style={{ padding: '16px', background: 'white', fontSize: '12px', color: '#64748B' }}>
                    No organisation documents uploaded yet.
                  </div>
                )}
                {organisationDocuments.map((doc: any) => (
                    <div key={doc.name} style={{ 
                        padding: '14px 16px', 
                        background: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                    }} onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: doc.status === 'VERIFIED' ? 'var(--cr)' : '#CBD5E1' }}></div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>{doc.name}</div>
                        </div>
                        <Badge variant={doc.status === 'VERIFIED' ? 'success' : 'warning'}>
                          {String(doc.status || 'UPLOADED').toUpperCase()}
                        </Badge>
                    </div>
                ))}
             </div>
             <Button variant="ghost" style={{ width: '100%', marginTop: '16px', fontSize: '12px', fontWeight: 800, color: 'var(--cr)', border: '1px solid #F1F5F9' }}>
                REQUEST DOCUMENT UPDATE
             </Button>
          </div>

          <div style={{ 
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #E5E7EB',
            padding: '28px'
          }}>
            <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#64748B', marginBottom: '16px', letterSpacing: '0.05em' }}>AUDIT LOG</h3>
            <div style={{ fontSize: '12px', color: '#4B5563', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ width: '4px', background: 'var(--cr)', borderRadius: '2px' }}></div>
                  <div>
                    <div style={{ fontWeight: 700 }}>System Verified</div>
                    <div style={{ fontSize: '10px', color: '#94A3B8' }}>2 hours ago by Miziba_AI</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ width: '4px', background: '#E5E7EB', borderRadius: '2px' }}></div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Account Provisioned</div>
                    <div style={{ fontSize: '10px', color: '#94A3B8' }}>5 days ago by Ops_Admin</div>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TraderManager;
