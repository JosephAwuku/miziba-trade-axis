"use client";

import React, { useState, useEffect } from 'react';
import { Trade, View } from '@/lib/types';
import { Button } from '../ui';
import StatusTracker from '../trader/StatusTracker';
import ApplicationForm from '../trader/ApplicationForm';
import TraderDocuments from '../trader/TraderDocuments';
import TraderOnboarding from '../trader/TraderOnboarding';
import TraderOverview from '../trader/TraderOverview';
import DraftsView from '../trader/DraftsView';
import TraderSettlementView from '../trader/TraderSettlementView';
import StageBadge from '../trader/StageBadge';
import { apiClient } from '@/lib/api';
import { commodityLabel } from '@/lib/data';
import { TraderVerificationProvider, useTraderVerification } from '@/lib/contexts/TraderVerificationContext';

interface TraderPortalProps {
  trades: Trade[];
  onNotify: (msg: string, type?: string) => void;
  view: string;
  onViewChange: (view: View) => void;
  onRefresh: () => void;
  user?: { full_name?: string; org_name?: string } | null;
}

const TraderPortalInner: React.FC<TraderPortalProps> = ({ trades, onNotify, view, onViewChange, onRefresh, user }) => {
  const { kycStatus, isLoading } = useTraderVerification();
  
  // Derive internal sub-view from global view ID
  const currentSubView = view.replace('trs_', '') as 'status' | 'apply' | 'company' | 'settle' | 'verify' | 'overview' | 'drafts';
  const profileView = currentSubView === 'verify' ? 'company' : currentSubView;
  const [activeTradeId, setActiveTradeId] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | undefined>(undefined);

  // Handle local navigation by updating global state
  const handleLocalNavigate = (subView: string) => {
    onViewChange(`trs_${subView}` as View);
  };
  
  // For the demo/prototype, we focus on the most recent trade
  const activeTrade = trades[0];

  return (
    <div className="fade-in">
      {/* Primary Trader Views */}
      
      {currentSubView === 'overview' && (
        <TraderOverview 
          trades={trades} 
          onNavigate={handleLocalNavigate} 
          onSelectTrade={setActiveTradeId}
          onNotify={onNotify}
          user={user}
        />
      )}

      {currentSubView === 'status' && (
        !activeTradeId ? (
          <div className="fade-in">
             <div className="card" style={{ padding: '24px' }}>
               <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '20px', color: 'var(--text)' }}>
                 Your Trade Applications
               </h3>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 {trades.length === 0 ? (
                   <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text2)' }}>No applications found.</div>
                 ) : (
                   trades.map(t => (
                     <div
                       key={t.id}
                       className="trader-application-row"
                       style={{
                         display: 'flex',
                         justifyContent: 'space-between',
                         alignItems: 'center',
                         padding: '16px 20px',
                         background: '#fff',
                         border: '1.5px solid transparent',
                         borderRadius: '12px',
                         transition: 'all 0.2s',
                         backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, var(--cr), var(--pu))',
                         backgroundOrigin: 'border-box',
                         backgroundClip: 'padding-box, border-box',
                         minWidth: 0,
                         boxSizing: 'border-box',
                       }}
                     >
                        <div className="trader-application-row__main" style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                            {commodityLabel(t.cmd)} · {t.vol} MT
                          </div>
                          <div
                            className="trader-application-row__meta"
                            style={{ fontSize: '13px', color: 'var(--text3)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}
                          >
                            <span>ID: <span className="mono">{t.id.slice(0, 8)}</span></span>
                            <span>Buyer: {t.buyer}</span>
                          </div>
                        </div>
                        <div className="trader-application-row__actions" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                          <StageBadge stage={t.stage} />
                          <Button
                            variant="primary"
                            size="sm"
                            className="trader-application-row__cta"
                            style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' }}
                            onClick={() => setActiveTradeId(t.id)}
                          >
                            <span className="hide-mobile">View Application →</span>
                            <span className="show-mobile">View →</span>
                          </Button>
                        </div>
                     </div>
                   ))
                 )}
               </div>
             </div>
          </div>
        ) : (
          (() => {
            const selectedTrade = trades.find(t => t.id === activeTradeId);
            if (!selectedTrade) return null;
            return (
              <div className="fade-in">
                <div style={{ marginBottom: '20px' }}>
                  <button 
                    onClick={() => setActiveTradeId(null)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      background: 'none', 
                      border: 'none', 
                      cursor: 'pointer', 
                      color: 'var(--cr)', 
                      fontSize: '13px', 
                      fontWeight: 800,
                      padding: '4px 0',
                      transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      letterSpacing: '0.02em'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(-4px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="19" y1="12" x2="5" y2="12"></line>
                      <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    BACK TO APPLICATIONS
                  </button>
                </div>
                <StatusTracker
                  trade={selectedTrade}
                  kycStatus={kycStatus}
                  onNavigateToVerify={() => handleLocalNavigate('company')}
                />
                <div className="card" style={{ padding: '24px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px', color: 'var(--text)', letterSpacing: '-0.01em' }}>Deal Summary</div>
                  <div className="g3" style={{ marginBottom: '12px' }}>
                    {[
                      ['Commodity', `${commodityLabel(selectedTrade.cmd)} Gr.${selectedTrade.gr}`],
                      ['Volume', `${selectedTrade.vol} MT`],
                      ['Contract Value', `$${selectedTrade.cv.toLocaleString()}`],
                      ['Your Equity', `$${selectedTrade.eq.toLocaleString()}`],
                      ['Finance Facility', `$${selectedTrade.ff.toLocaleString()}`],
                      ['Deadline', selectedTrade.dl],
                      ['Buyer', selectedTrade.buyer],
                      ['Delivery', selectedTrade.dp],
                      ['Payment Terms', `${selectedTrade.pt} days`]
                    ].map((x) => (
                      <div key={x[0]} style={{ background: '#F8FAFC', borderRadius: '7px', padding: '12px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 700, marginBottom: '4px', letterSpacing: '0.03em' }}>{x[0].toUpperCase()}</div>
                        <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text)' }}>{x[1]}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <TraderDocuments trade={selectedTrade} onNotify={onNotify} />
              </div>
            );
          })()
        )
      )}

      {currentSubView === 'apply' && (
        <ApplicationForm 
          onNotify={onNotify}
          onNavigate={handleLocalNavigate}
          draftId={editingDraftId}
          onSuccess={(newTrade) => {
            setEditingDraftId(undefined);
            onRefresh();
            onViewChange('trs_overview');
          }}
          onDraftSaved={() => {
            onNotify('Draft saved successfully', 'success');
          }}
        />
      )}

      {currentSubView === 'drafts' && (
        <DraftsView 
          onEditDraft={(draftId) => {
            setEditingDraftId(draftId);
            onViewChange('trs_apply');
          }}
          onNotify={onNotify}
          onNavigate={handleLocalNavigate}
        />
      )}

      {(profileView === 'company') && (
        <TraderOnboarding onNotify={onNotify} />
      )}

      {currentSubView === 'settle' && (
        <TraderSettlementView trades={trades} onNotify={onNotify} />
      )}
    </div>
  );
};

// Wrap with verification provider to avoid re-fetching on every navigation
const TraderPortal: React.FC<TraderPortalProps> = (props) => {
  return (
    <TraderVerificationProvider>
      <TraderPortalInner {...props} />
    </TraderVerificationProvider>
  );
};

export default TraderPortal;
