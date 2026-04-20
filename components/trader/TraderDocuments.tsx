"use client";

import React from 'react';
import { Trade } from '@/lib/types';

interface TraderDocumentsProps {
  trade: Trade;
  onNotify: (msg: string, type?: string) => void;
}

const TraderDocuments: React.FC<TraderDocumentsProps> = ({ trade, onNotify }) => {
  const docs = [
    { n: 'Certificate of Incorporation', req: true, st: 'ACCEPTED' },
    { n: 'TIN Certificate', req: true, st: 'ACCEPTED' },
    { n: 'Director ID', req: true, st: 'UNDER REVIEW' },
    { n: 'Signed Offtake Contract', req: true, st: 'PENDING' },
    { n: 'Export Licence', req: false, st: 'PENDING' },
    { n: 'Bank Account Proof', req: true, st: 'PENDING' }
  ];

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-head" style={{ padding: '12px 16px', borderBottom: '1px solid var(--bdr)', fontWeight: 600 }}>
        Documents — {trade.id}
      </div>
      {docs.map((doc, i) => {
        const statusColors: any = {
           ACCEPTED: { bg: '#F0FDF4', c: '#16A34A', b: '#BBF7D0' },
           PENDING: { bg: '#F9FAFB', c: '#9CA3AF', b: '#E5E7EB' },
           'UNDER REVIEW': { bg: '#FFFBEB', c: '#D97706', b: '#FDE68A' }
        };
        const st = statusColors[doc.st] || statusColors.PENDING;
        
        return (
          <div 
            key={doc.n}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              padding: '11px 14px', 
              borderBottom: '1px solid #F3F4F6', 
              background: i % 2 === 0 ? '#fff' : '#FAFBFC',
              flexWrap: 'wrap'
            }}
          >
            <span style={{ fontSize: '14px', color: '#9CA3AF' }}>◈</span>
            <div style={{ flex: 1, minWidth: '120px', fontSize: '11px', fontWeight: 500 }}>
              {doc.n}
              {doc.req && <span style={{ color: '#DC2626' }}> *</span>}
            </div>
            <span 
              className="badge" 
              style={{ 
                background: st.bg, 
                color: st.c, 
                border: `1px solid ${st.b}`,
                padding: '2px 7px',
                borderRadius: '99px',
                fontSize: '10px',
                fontWeight: 600
              }}
            >
              {doc.st}
            </span>
            {doc.st === 'PENDING' && (
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => onNotify(`Upload feature for ${doc.n} is being integrated.`, 'info')}
              >
                Upload
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TraderDocuments;
