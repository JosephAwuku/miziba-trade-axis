"use client";

import React, { useState, useEffect } from 'react';
import { Trade, View } from '@/lib/types';
import { Button } from '../ui';
import StatusTracker from '../trader/StatusTracker';
import ApplicationForm from '../trader/ApplicationForm';
import TraderDocuments from '../trader/TraderDocuments';
import TraderOnboarding from '../trader/TraderOnboarding';
import TraderOverview from '../trader/TraderOverview';

interface TraderPortalProps {
  trades: Trade[];
  onNotify: (msg: string, type?: string) => void;
  view: string;
  onViewChange: (view: View) => void;
}

const TraderPortal: React.FC<TraderPortalProps> = ({ trades, onNotify, view, onViewChange }) => {
  // Derive internal sub-view from global view ID
  const currentSubView = view.replace('trs_', '') as 'status' | 'apply' | 'docs' | 'settle' | 'verify' | 'overview';
  const [activeTradeId, setActiveTradeId] = useState<string | null>(null);

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
        <TraderOverview trades={trades} onNavigate={handleLocalNavigate} onNotify={onNotify} />
      )}

      {currentSubView === 'status' && (
        activeTrade ? (
          <div className="fade-in">
            <StatusTracker trade={activeTrade} />
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--text)' }}>Deal Summary</div>
              <div className="g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {[
                  ['Commodity', `${activeTrade.cmd} Gr.${activeTrade.gr}`],
                  ['Volume', `${activeTrade.vol} MT`],
                  ['Contract Value', `$${activeTrade.cv.toLocaleString()}`],
                  ['Your Equity', `$${activeTrade.eq.toLocaleString()}`],
                  ['Finance Facility', `$${activeTrade.ff.toLocaleString()}`],
                  ['Deadline', activeTrade.dl],
                  ['Buyer', activeTrade.buyer],
                  ['Delivery', activeTrade.dp],
                  ['Payment Terms', `${activeTrade.pt} days`]
                ].map((x) => (
                  <div key={x[0]} style={{ background: '#F8FAFC', borderRadius: '7px', padding: '10px' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text3)', fontWeight: 600, marginBottom: '3px' }}>{x[0].toUpperCase()}</div>
                    <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text)' }}>{x[1]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ 
            padding: '60px', 
            textAlign: 'center', 
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
            border: '2px solid transparent',
            backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, var(--cr), var(--pu))',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>
              No active trades found
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 1.6, maxWidth: '420px', margin: '0 auto 24px' }}>
              You haven&apos;t started any trades yet. To begin getting funding for your trades, please submit your first application.
            </p>
            <Button 
                variant="primary" 
                style={{ padding: '14px 36px', fontSize: '15px', fontWeight: 700, boxShadow: '0 4px 12px rgba(139, 0, 0, 0.2)' }}
                onClick={() => handleLocalNavigate('apply')}
            >
              Submit New Trade Application
            </Button>
          </div>
        )
      )}

      {currentSubView === 'apply' && (
        <ApplicationForm 
          onNotify={onNotify} 
          onSuccess={(newTrade) => {
            // Root fetchTrades will handle refresh
          }} 
        />
      )}

      {currentSubView === 'verify' && (
        <TraderOnboarding onNotify={onNotify} />
      )}

      {currentSubView === 'docs' && (
        activeTrade ? (
          <TraderDocuments trade={activeTrade} onNotify={onNotify} />
        ) : (
          <div className="card" style={{ 
            padding: '60px', 
            textAlign: 'center', 
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
            border: '2px solid transparent',
            backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, var(--cr), var(--pu))',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>
              No documents to show yet
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 1.6, maxWidth: '420px', margin: '0 auto 24px' }}>
              Documents will appear here once your trade starts and is being processed. 
            </p>
            <Button 
                variant="primary" 
                style={{ padding: '14px 36px', fontSize: '15px', fontWeight: 700, boxShadow: '0 4px 12px rgba(139, 0, 0, 0.2)' }}
                onClick={() => handleLocalNavigate('apply')}
            >
              Start New Trade Application
            </Button>
          </div>
        )
      )}

      {currentSubView === 'settle' && (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>⬢</div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Settlement Records</div>
          <p style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1.6', maxWidth: '300px', margin: '0 auto' }}>
            Settlement records and waterfall summary appear after trade closure.
          </p>
        </div>
      )}
    </div>
  );
};

export default TraderPortal;
