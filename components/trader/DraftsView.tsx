"use client";

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Button, Card } from '@/components/ui';
import { CMD } from '@/lib/data';
import TraderKycReminderCard from './TraderKycReminderCard';

interface DraftsViewProps {
  onEditDraft: (draftId: string) => void;
  onNotify: (msg: string, type?: string) => void;
  onNavigate?: (subView: string) => void;
}

const DraftsView: React.FC<DraftsViewProps> = ({ onEditDraft, onNotify, onNavigate }) => {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [canSubmitTrades, setCanSubmitTrades] = useState(false);

  useEffect(() => {
    loadDrafts();
    (async () => {
      try {
        const profile = await apiClient.getTraderProfile();
        setCanSubmitTrades(profile.can_submit_trades === true || profile.is_fully_verified === true);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const loadDrafts = async () => {
    try {
      setLoading(true);
      const { drafts: data } = await apiClient.getDrafts();
      setDrafts(data || []);
    } catch (err) {
      console.error('Failed to load drafts:', err);
      onNotify('Failed to load drafts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (draftId: string) => {
    if (!confirm('Are you sure you want to delete this draft?')) return;

    try {
      setDeleting(draftId);
      await apiClient.deleteDraft(draftId);
      onNotify('Draft deleted successfully', 'success');
      loadDrafts();
    } catch (err: any) {
      onNotify(err.message || 'Failed to delete draft', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text2)' }}>Loading drafts...</p>
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text1)' }}>
            No drafts yet
          </h3>
          <p style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.6 }}>
            Save your trade applications as drafts to continue working on them later. 
            Drafts are automatically saved when you click &ldquo;Save as Draft&rdquo; in the application form.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {!canSubmitTrades && onNavigate && (
        <TraderKycReminderCard
          onNavigateToCompany={() => onNavigate('company')}
          marginBottom="20px"
        />
      )}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text1)', marginBottom: '8px' }}>
          Draft Applications
        </h2>
        <p style={{ color: 'var(--text2)', fontSize: '14px' }}>
          {drafts.length} draft{drafts.length !== 1 ? 's' : ''} saved
        </p>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {drafts.map((draft) => {
          const draftData = draft.draft_data || {};
          const commodity = draftData.commodity ? CMD[draftData.commodity as keyof typeof CMD]?.l : null;
          const volume = draftData.volume_mt;
          const buyer = draftData.buyer_id;

          return (
            <Card key={draft.id} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text1)', margin: 0 }}>
                      {draft.title || 'Untitled Draft'}
                    </h3>
                    <span
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '12px',
                        background: 'var(--yw-bg)',
                        color: 'var(--yw)',
                      }}
                    >
                      Step {Math.min(draft.last_edited_step || 1, 4)} of 4
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '12px' }}>
                    {commodity && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Commodity:</span>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text1)' }}>{commodity}</span>
                      </div>
                    )}
                    {volume && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Volume:</span>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text1)' }}>{volume} MT</span>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                    Last edited {formatDate(draft.updated_at)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant="primary"
                    onClick={() => onEditDraft(draft.id)}
                    style={{ fontSize: '13px', padding: '8px 16px' }}
                  >
                    Continue
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleDelete(draft.id)}
                    disabled={deleting === draft.id}
                    style={{ fontSize: '13px', padding: '8px 16px' }}
                  >
                    {deleting === draft.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default DraftsView;
