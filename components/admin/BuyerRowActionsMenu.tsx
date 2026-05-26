"use client";

import React, { useRef, useEffect } from "react";

const IconPencil = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

export interface BuyerRowActionsMenuProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onEditProfile: () => void;
  onDeleteBuyer: () => void;
}

/**
 * Kebab (⋮) dropdown — buyer table actions (same pattern as user row menu).
 */
export function BuyerRowActionsMenu({
  isOpen,
  onOpen,
  onClose,
  onEditProfile,
  onDeleteBuyer,
}: BuyerRowActionsMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    padding: "10px 14px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
    color: "#111827",
    textAlign: "left",
    borderRadius: "6px",
  };

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Buyer actions"
        onClick={() => (isOpen ? onClose() : onOpen())}
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "8px",
          border: "1px solid #E5E7EB",
          background: isOpen ? "#F3F4F6" : "#fff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#374151",
          fontSize: "18px",
          fontWeight: 700,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ⋮
      </button>
      {isOpen && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            minWidth: "220px",
            background: "#fff",
            borderRadius: "10px",
            boxShadow: "0 10px 40px rgba(15, 23, 42, 0.12), 0 0 1px rgba(15, 23, 42, 0.08)",
            border: "1px solid #E5E7EB",
            padding: "6px",
            zIndex: 50,
          }}
        >
          <button
            type="button"
            role="menuitem"
            style={itemStyle}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onClose();
              onEditProfile();
            }}
          >
            <IconPencil />
            Edit buyer profile
          </button>
          <button
            type="button"
            role="menuitem"
            style={{ ...itemStyle, color: "#B91C1C" }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onClose();
              onDeleteBuyer();
            }}
          >
            <IconTrash />
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              Delete buyer
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#fff",
                  background: "#DC2626",
                  borderRadius: "999px",
                  width: "16px",
                  height: "16px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                !
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
