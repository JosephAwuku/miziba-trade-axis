"use client";

import React, { useEffect, useState } from "react";
import { Card, Button, CustomSelect } from "@/components/ui";
import { apiClient } from "@/lib/api";
import { usd } from "@/lib/utils";

export interface AdminBuyerEditPageProps {
  buyerId: string;
  onBack: () => void;
  onNotify: (msg: string, type?: string) => void;
}

type BuyerDetail = {
  id: string;
  name: string;
  country: string;
  registration_no: string | null;
  notes: string | null;
  sanctions_clear: boolean;
  credit_rating: string;
  creditworthiness_score: number;
  trades_completed: number;
  trades_on_time: number;
  disputes: number;
  total_volume_usd: number;
  last_trade_date: string | null;
};

export default function AdminBuyerEditPage({ buyerId, onBack, onNotify }: AdminBuyerEditPageProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [creditRating, setCreditRating] = useState("A");
  const [notes, setNotes] = useState("");
  const [sanctionsClear, setSanctionsClear] = useState(true);
  const [meta, setMeta] = useState<Pick<BuyerDetail, "trades_completed" | "trades_on_time" | "disputes" | "total_volume_usd" | "last_trade_date"> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.getBuyer(buyerId);
        if (cancelled) return;
        const d = res.data as BuyerDetail;
        setName(d.name);
        setCountry(d.country);
        setRegistrationNo(d.registration_no || "");
        setCreditRating(d.credit_rating || "A");
        setNotes(d.notes || "");
        setSanctionsClear(d.sanctions_clear);
        setMeta({
          trades_completed: d.trades_completed,
          trades_on_time: d.trades_on_time,
          disputes: d.disputes,
          total_volume_usd: d.total_volume_usd,
          last_trade_date: d.last_trade_date,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load buyer.";
        onNotify(msg, "error");
        onBack();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buyerId, onBack, onNotify]);

  const onTimePct =
    meta && meta.trades_completed > 0
      ? Math.round((meta.trades_on_time / meta.trades_completed) * 100)
      : 100;

  const metaItem = (label: string, value: string, valueStyle?: React.CSSProperties) => (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: "10px",
        background: "#F8FAFC",
        border: "1px solid var(--bdr)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text3)",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", lineHeight: 1.35, ...valueStyle }}>{value}</div>
    </div>
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.updateBuyer(buyerId, {
        name: name.trim(),
        country: country.trim(),
        registration_no: registrationNo.trim() || null,
        notes: notes.trim() || null,
        sanctions_clear: sanctionsClear,
        credit_rating: creditRating,
      });
      onNotify("Buyer profile updated.", "success");
      onBack();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed.";
      onNotify(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fade-in" style={{ padding: "40px", textAlign: "center", color: "var(--text3)" }}>
        Loading buyer…
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: "28px" }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            color: "var(--cr)",
            fontSize: "13px",
            fontWeight: 800,
            marginBottom: "16px",
            background: "none",
            border: "none",
            padding: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          BACK TO BUYER DATABASE
        </button>
        <h2 style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.03em", color: "var(--text)" }}>Buyer profile</h2>
        <p style={{ color: "var(--text3)", fontSize: "14px", marginTop: "6px" }}>Review credit signals and update buyer records.</p>
      </div>

      <Card style={{ padding: "28px 32px", width: "100%", maxWidth: "960px" }}>
        {meta && (
          <div className="g3" style={{ marginBottom: "28px" }}>
            {metaItem("Settled trades", String(meta.trades_completed))}
            {metaItem("On-time %", `${onTimePct}%`)}
            {metaItem("Disputes", String(meta.disputes))}
            {metaItem("Volume (settled)", usd(meta.total_volume_usd))}
            {metaItem(
              "Last settled",
              meta.last_trade_date ? new Date(meta.last_trade_date).toLocaleDateString() : "—"
            )}
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--bdr)", paddingTop: "28px", marginBottom: "8px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text)", marginBottom: "20px", letterSpacing: "-0.01em" }}>
            Buyer details
          </h3>

          <div className="g2" style={{ marginBottom: "8px" }}>
            <div className="field">
              <label>Legal company name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Company name" />
            </div>
            <div className="field">
              <label>Country</label>
              <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} required placeholder="e.g. Ghana" />
            </div>
          </div>

          <div className="g2" style={{ marginBottom: "8px" }}>
            <div className="field">
              <label>Registration number (optional)</label>
              <input type="text" value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} placeholder="e.g. REG-123456" />
            </div>
            <div className="field">
              <label>Credit rating</label>
              <CustomSelect
                name="credit_rating"
                value={creditRating}
                onChange={(e) => setCreditRating(e.target.value)}
                options={[
                  { label: "AAA — Exceptional", value: "AAA" },
                  { label: "AA — High quality", value: "AA" },
                  { label: "A — Reliable", value: "A" },
                  { label: "BBB — Investment grade", value: "BBB" },
                  { label: "BB — Speculative", value: "BB" },
                ]}
              />
            </div>
          </div>

          <div className="field" style={{ marginBottom: "16px" }}>
            <label>Internal notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Relationship history, risk notes…"
              style={{ minHeight: "88px", resize: "vertical" }}
            />
          </div>

          <div className="field" style={{ marginBottom: "24px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={sanctionsClear}
                onChange={(e) => setSanctionsClear(e.target.checked)}
                style={{ width: "18px", height: "18px", accentColor: "var(--cr)" }}
              />
              Sanctions cleared (verified against watchlists)
            </label>
          </div>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <Button type="button" variant="secondary" style={{ minWidth: "140px", fontWeight: 700 }} onClick={onBack}>
              Cancel
            </Button>
            <Button type="button" variant="primary" style={{ minWidth: "180px", fontWeight: 800 }} disabled={saving} onClick={handleSave}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
