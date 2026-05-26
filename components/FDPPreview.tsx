"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge } from './ui';
import { apiClient } from '@/lib/api';
import { isApiError } from '@/lib/api-errors';

interface FDPPreviewProps {
  tradeId: string;
  onNotify: (msg: string, type?: string) => void;
  onGenerated?: () => void;
  readOnly?: boolean;
}

const FDPPreview: React.FC<FDPPreviewProps> = ({ tradeId, onNotify, onGenerated, readOnly = false }) => {
  const [fdpData, setFdpData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);

  const fetchFDP = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getFinanceDataPackage(tradeId);
      setFdpData(res.fdp);
    } catch (err) {
      console.error('Failed to fetch FDP:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFDP();
  }, [tradeId]);

  const handleGenerate = async () => {
    try {
      setGenLoading(true);
      const res = await apiClient.generateFinanceDataPackage(tradeId, {}) as {
        success?: boolean;
        message?: string;
        advanced_to_finance_review?: boolean;
        requires_ceo_approval?: boolean;
      };
      const msg =
        res.message ||
        (res.advanced_to_finance_review !== false
          ? 'Finance Data Package generated and trade sent to Finance Review.'
          : 'FDP generated. CEO approval required before Finance Review.');
      onNotify(msg, res.requires_ceo_approval ? 'warning' : undefined);
      fetchFDP();
      onGenerated?.();
    } catch (err) {
      onNotify(isApiError(err) ? err.message : 'Failed to generate FDP', 'error');
    } finally {
      setGenLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      setLoading(true);
      // We expect the API to return a signed URL or handle the download
      const res = await fetch(`/api/trades/${tradeId}/fdp/download`);
      const data = await res.json();
      
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('Download URL not found');
      }
    } catch (err) {
      onNotify('Failed to download FDP PDF', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !fdpData) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Package...</div>;

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Finance Data Package (FDP)</h3>
        {fdpData?.pdf_ready && (
          <Button variant="primary" onClick={handleDownload} disabled={loading}>
            📥 Download Formal PDF
          </Button>
        )}
      </div>

      {!fdpData ? (
        <Card style={{ padding: '30px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>📄</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>No FDP Generated Yet</div>
          <p style={{ fontSize: '12px', color: '#6B7280', margin: '8px 0 20px' }}>
            A formal Finance Data Package is required for Finance Partner review.
          </p>
          <Button onClick={handleGenerate} disabled={genLoading || readOnly}>
            {genLoading ? 'Generating...' : '🛠 Generate Package Now'}
          </Button>
        </Card>
      ) : (
        <div className="g2">
          <Card title="PACKAGE AUDIT" style={{ padding: '16px' }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600, marginBottom: '2px' }}>STATUS</div>
              <Badge variant={fdpData.pdf_ready ? 'success' : 'warning'}>
                {fdpData.pdf_ready ? 'PDF DOCUMENT READY' : 'PREVIEW ONLY'}
              </Badge>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600, marginBottom: '2px' }}>GENERATED AT</div>
              <div style={{ fontSize: '12px' }}>{new Date(fdpData.generated_at).toLocaleString()}</div>
            </div>
            {fdpData.sent_to_fp_at && (
              <div>
                <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600, marginBottom: '2px' }}>SENT TO PARTNER</div>
                <div style={{ fontSize: '12px' }}>{new Date(fdpData.sent_to_fp_at).toLocaleString()}</div>
              </div>
            )}
          </Card>

          <Card title="WATERFALL PREVIEW" style={{ padding: '16px' }}>
            <div style={{ fontSize: '11px', color: '#4B5563', marginBottom: '15px' }}>
              Standard 8.0% PA disbursement schedule applied to contract value.
            </div>
            {fdpData.waterfall_preview && fdpData.waterfall_preview.map((inst: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6', fontSize: '11px' }}>
                <span>{inst.purpose}</span>
                <span className="mono" style={{ fontWeight: 600 }}>${inst.amount.toLocaleString()}</span>
              </div>
            ))}
            {!fdpData.waterfall_preview && <div style={{ fontSize: '11px', fontStyle: 'italic' }}>Detailed waterfall in PDF document.</div>}
            
            {!readOnly && (
            <div style={{ marginTop: '20px' }}>
               <Button variant="secondary" style={{ width: '100%' }} onClick={handleGenerate} disabled={genLoading}>
                 🔄 Regenerate with Latest Data
               </Button>
            </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default FDPPreview;
