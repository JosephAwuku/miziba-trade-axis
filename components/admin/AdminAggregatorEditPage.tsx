"use client";

import React, { useEffect, useState } from "react";
import { Card, Button, CustomSelect } from "@/components/ui";
import { apiClient } from "@/lib/api";
import { usd } from "@/lib/utils";

export interface AdminAggregatorEditPageProps {
  aggregatorId: string;
  onBack: () => void;
  onNotify: (msg: string, type?: string) => void;
}

type AggregatorDetail = {
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

export default function AdminAggregatorEditPage({ aggregatorId, onBack, onNotify }: AdminAggregatorEditPageProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [creditRating, setCreditRating] = useState("A");
  const [notes, setNotes] = useState("");
  const [sanctionsClear, setSanctionsClear] = useState(true);
  const [meta, setMeta] = useState<Pick<AggregatorDetail, "trades_completed" | "trades_on_time" | "disputes" | "total_volume_usd" | "last_trade_date"> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.getAggregator(aggregatorId);
        if (cancelled) return;
        const d = res.data as AggregatorDetail;
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
        const msg = e instanceof Error ? e.message : "Failed to load aggregator.";
        onNotify(msg, "error");
        onBack();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [aggregatorId, onBack, onNotify]);

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
      <div
        style={{
          fontSize: "18px",
          fontWeight: 800,
          color: "var(--text)",
          letterSpacing: "-0.01em",
          ...valueStyle,
        }}
      >
        {value}
      </div>
    </div>
  );

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.updateAggregator(aggregatorId, {
        name: name.trim() || undefined,
        country: country.trim() || undefined,
        registration_no: registrationNo.trim() || null,
        credit_rating: creditRating,
        notes: notes.trim() || null,
        sanctions_clear: sanctionsClear,
      });
      onNotify("Aggregator profile updated.", "success");
      onBack();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update aggregator.";
      onNotify(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text2)" }}>Loading...</div>;
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: "24px" }}>
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--cr)",
            fontSize: "13px",
            fontWeight: 800,
            padding: "4px 0",
            transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            letterSpacing: "0.02em",
            marginBottom: "16px",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "translateX(-4px)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          BACK TO AGGREGATORS
        </button>
        <h2 style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.03em", color: "var(--text)" }}>Aggregator profile</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {metaItem("Completed deals", String(meta?.trades_completed ?? 0))}
        {metaItem("On-time %", `${onTimePct}%`, { color: onTimePct >= 90 ? "#16A34A" : onTimePct >= 70 ? "#D97706" : "#DC2626" })}
        {metaItem("Disputes", String(meta?.disputes ?? 0), { color: (meta?.disputes ?? 0) > 0 ? "#DC2626" : "inherit" })}
        {metaItem("Total volume", usd(meta?.total_volume_usd ?? 0))}
      </div>

      <Card style={{ padding: "32px" }}>
        <form onSubmit={onSave}>
          <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "20px", color: "var(--text)" }}>
            Aggregator details
          </h3>
          <div className="g2" style={{ marginBottom: "24px" }}>
            <div className="field">
              <label>Aggregator name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Country *</label>
              <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} required />
            </div>
            <div className="field">
              <label>Registration number</label>
              <input type="text" value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} />
            </div>
            <div className="field">
              <label>Credit rating *</label>
              <CustomSelect
                name="credit_rating"
                value={creditRating}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreditRating(e.target.value)}
                options={[
                  { label: "AAA (Excellent)", value: "AAA" },
                  { label: "AA (Very Good)", value: "AA" },
                  { label: "A (Good)", value: "A" },
                  { label: "BBB (Adequate)", value: "BBB" },
                  { label: "BB (Marginal)", value: "BB" },
                ]}
              />
            </div>
          </div>

          <div className="field" style={{ marginBottom: "24px" }}>
            <label>
              <input
                type="checkbox"
                checked={sanctionsClear}
                onChange={(e) => setSanctionsClear(e.target.checked)}
                style={{ marginRight: "8px" }}
              />
              Sanctions clear (OFAC / UN)
            </label>
          </div>

          <div className="field" style={{ marginBottom: "24px" }}>
            <label>Notes (internal only)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--bdr)", fontFamily: "inherit" }}
            />
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <Button type="submit" disabled={saving} variant="primary">
              {saving ? "Saving..." : "Save changes"}
            </Button>
            <Button type="button" variant="secondary" onClick={onBack}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
