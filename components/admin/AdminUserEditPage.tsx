"use client";

import React, { useEffect, useState } from "react";
import { Card, Button } from "@/components/ui";
import { apiClient } from "@/lib/api";

const roleLabel: Record<string, string> = {
  ceo: "CEO",
  cfo: "CFO",
  deal_officer: "Deal Officer",
  trader: "Trader",
  finance_partner: "Finance Partner",
  ops_admin: "Operations Admin",
};

export interface AdminUserEditPageProps {
  userId: string;
  onBack: () => void;
  onNotify: (msg: string, type?: string) => void;
  onSaved?: () => void;
}

export default function AdminUserEditPage({ userId, onBack, onNotify, onSaved }: AdminUserEditPageProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [orgName, setOrgName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [role, setRole] = useState("");
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [adminAddedAt, setAdminAddedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.getAdminUser(userId);
        if (cancelled) return;
        const d = res.data;
        setFullName(d.full_name);
        setEmail(d.email);
        setPhone(d.phone || "");
        setOrgName(d.org_name || "");
        setIsActive(d.is_active);
        setRole(d.role);
        setKycStatus(d.kyc_status);
        setAdminAddedAt(d.admin_added_at);
      } catch (e: any) {
        onNotify(e?.message || "Failed to load user.", "error");
        onBack();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const partnerOrg = role === "trader" || role === "finance_partner";
  const kycDisplay = partnerOrg && kycStatus ? kycStatus : "—";
  const addedDisplay = adminAddedAt ? new Date(adminAddedAt).toLocaleString() : "—";
  const readOnlyInputStyle = { background: "#F8FAFC", cursor: "default" as const };

  const kycTone =
    kycDisplay === "VERIFIED"
      ? { color: "#065F46", bg: "#D1FAE5" }
      : kycDisplay === "PENDING" || kycDisplay === "UNDER_REVIEW"
        ? { color: "#92400E", bg: "#FEF3C7" }
        : { color: "var(--text3)", bg: "#F3F4F6" };

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
      <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", lineHeight: 1.35, ...valueStyle }}>
        {value}
      </div>
    </div>
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.updateAdminUser(userId, {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        is_active: isActive,
        ...(partnerOrg && orgName.trim() ? { org_name: orgName.trim() } : {}),
      });
      onNotify("User profile updated.", "success");
      onSaved?.();
      onBack();
    } catch (e: any) {
      onNotify(e?.message || "Save failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fade-in" style={{ padding: "40px", textAlign: "center", color: "var(--text3)" }}>
        Loading user…
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
          BACK TO USER DIRECTORY
        </button>
        <h2 style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.03em", color: "var(--text)" }}>Edit user profile</h2>
        <p style={{ color: "var(--text3)", fontSize: "14px", marginTop: "6px" }}>
          Update account details. Role changes and advanced organisation tools will follow in a later release.
        </p>
      </div>

      <Card style={{ padding: "28px 32px", width: "100%", maxWidth: "960px" }}>
        <div className="g3" style={{ marginBottom: "28px" }}>
          {metaItem("Role", roleLabel[role] || role)}
          {metaItem("Organisation KYC", kycDisplay, {
            display: "inline-block",
            padding: "4px 10px",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 800,
            ...kycTone,
          })}
          {metaItem("Added to system", addedDisplay, { fontWeight: 600, fontSize: "14px", color: "var(--text2)" })}
        </div>

        <div
          style={{
            borderTop: "1px solid var(--bdr)",
            paddingTop: "28px",
            marginBottom: "8px",
          }}
        >
          <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text)", marginBottom: "20px", letterSpacing: "-0.01em" }}>
            Account details
          </h3>

          <div className="g2" style={{ marginBottom: "8px" }}>
            <div className="field">
              <label>Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                placeholder="Full name"
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="user@example.com"
              />
            </div>
          </div>

          <div className="g2" style={{ marginBottom: "8px" }}>
            <div className="field">
              <label>Phone (optional)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="e.g. +233 20 000 0000"
              />
            </div>
            {partnerOrg ? (
              <div className="field">
                <label>Institution / organisation name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Organisation name"
                />
              </div>
            ) : (
              <div className="field">
                <label>Institution / organisation name</label>
                <input type="text" value="—" readOnly style={readOnlyInputStyle} />
              </div>
            )}
          </div>

          <div className="g2">
            <div className="field">
              <label>Account status</label>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  cursor: "pointer",
                  marginBottom: 0,
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: "2px solid transparent",
                  backgroundImage: "linear-gradient(#fff, #fff), linear-gradient(135deg, var(--cr), var(--pu))",
                  backgroundOrigin: "border-box",
                  backgroundClip: "padding-box, border-box",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  minHeight: "52px",
                }}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ marginTop: "3px", width: "18px", height: "18px", flexShrink: 0, accentColor: "var(--cr)" }}
                />
                <span style={{ fontSize: "15px", lineHeight: 1.5, fontWeight: 600, color: "var(--text)" }}>
                  Account active (can sign in)
                </span>
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", borderTop: "1px solid var(--bdr)", paddingTop: "24px" }}>
          <Button variant="primary" onClick={handleSave} disabled={saving || !fullName.trim() || !email.trim()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button variant="secondary" onClick={onBack} disabled={saving}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
