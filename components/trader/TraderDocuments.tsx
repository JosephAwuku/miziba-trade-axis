"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Trade } from '@/lib/types';
import { apiClient } from '@/lib/api';
import { Button, Badge } from '../ui';
import {
  TRADE_DOC_SPECS,
  countMissingRequiredTradeDocs,
  getTradeDocSpecStatus,
  type TradeDocumentRecord,
} from '@/lib/trade-documents';

interface TraderDocumentsProps {
  onNotify: (msg: string, type?: string) => void;
  trade?: Trade;
  draftId?: string;
  onDocumentsChange?: (documents: TradeDocumentRecord[]) => void;
}

const TraderDocuments: React.FC<TraderDocumentsProps> = ({
  trade,
  draftId,
  onNotify,
  onDocumentsChange,
}) => {
  const [documents, setDocuments] = useState<TradeDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadKey, setPendingUploadKey] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      if (draftId) {
        const res = await apiClient.getDraftDocuments(draftId);
        setDocuments(res.documents || []);
        onDocumentsChange?.(res.documents || []);
      } else if (trade?.id) {
        const res = await apiClient.getTradeDocuments(trade.id);
        const mapped = (res.documents || []).map((d: any) => ({
          doc_type: d.type,
          name: d.name,
          status: d.status,
          url: d.url,
          size_bytes: d.size_bytes,
        }));
        setDocuments(mapped);
        onDocumentsChange?.(mapped);
      } else {
        setDocuments([]);
        onDocumentsChange?.([]);
      }
    } catch {
      onNotify('Could not load documents', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [trade?.id, draftId]);

  const requiredMissing = countMissingRequiredTradeDocs(documents);

  const triggerUpload = (specKey: string) => {
    setPendingUploadKey(specKey);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const specKey = pendingUploadKey;
    e.target.value = '';
    setPendingUploadKey(null);
    if (!file || !specKey) return;

    const label = TRADE_DOC_SPECS.find((s) => s.key === specKey)?.label || specKey;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', specKey);
    formData.append('name', `${label} — ${file.name}`);

    try {
      setUploadingKey(specKey);
      if (draftId) {
        await apiClient.uploadDraftDocument(draftId, formData);
      } else if (trade?.id) {
        await apiClient.uploadDocument(trade.id, formData);
      } else {
        onNotify('Save your application as a draft before uploading documents.', 'warning');
        return;
      }
      onNotify('Document uploaded — pending review');
      await load();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploadingKey(null);
    }
  };

  const statusStyle = {
    accepted: { bg: '#FFF5F5', c: '#8B0000', b: '#FECACA', label: 'APPROVED' },
    review: { bg: '#FFFBEB', c: '#D97706', b: '#FDE68A', label: 'UNDER REVIEW' },
    rejected: { bg: '#FEF2F2', c: '#DC2626', b: '#FECACA', label: 'REJECTED' },
    pending: { bg: '#F9FAFB', c: '#9CA3AF', b: '#E5E7EB', label: 'REQUIRED' },
  };

  return (
    <div className="card" style={{ overflow: 'hidden', marginTop: draftId ? 0 : '16px', marginBottom: '14px' }}>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onChange={handleFileChange}
      />
      <div
        className="card-head"
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--bdr)',
          fontSize: '16px',
          fontWeight: 800,
          color: 'var(--text)',
          letterSpacing: '-0.01em',
        }}
      >
        Trade documents (this deal only)
        {requiredMissing > 0 && (
          <span style={{ marginLeft: '8px', fontSize: '12px', color: '#DC2626', fontWeight: 700 }}>
            · {requiredMissing} required missing
          </span>
        )}
      </div>
      {loading ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
          Loading documents…
        </div>
      ) : (
        TRADE_DOC_SPECS.map((spec, i) => {
          const { status, file } = getTradeDocSpecStatus(documents, spec);
          const st = statusStyle[status];
          const canReupload = status === 'pending' || status === 'rejected';

          return (
            <div
              key={spec.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 24px',
                borderBottom: '1px solid #F3F4F6',
                background: i % 2 === 0 ? '#fff' : '#FAFBFC',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: '14px', color: '#9CA3AF' }}>◈</span>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text)' }}>
                  {spec.label}
                  {spec.required && <span style={{ color: '#DC2626' }}> *</span>}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{spec.hint}</div>
                {file?.name && (
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{file.name}</div>
                )}
              </div>
              <Badge
                style={{
                  background: st.bg,
                  color: st.c,
                  border: `1px solid ${st.b}`,
                  fontSize: '11px',
                }}
              >
                {st.label}
              </Badge>
              {file?.url && (
                <Button variant="ghost" size="sm" onClick={() => window.open(file.url!, '_blank')}>
                  View
                </Button>
              )}
              {canReupload && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={uploadingKey === spec.key || (!draftId && !trade?.id)}
                  onClick={() => triggerUpload(spec.key)}
                >
                  {uploadingKey === spec.key ? 'Uploading…' : status === 'rejected' ? 'Re-upload' : 'Upload'}
                </Button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default TraderDocuments;
