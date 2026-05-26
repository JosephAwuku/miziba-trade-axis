"use client";

import React from "react";
import { Notification } from "@/lib/types";
import { TradeApplicationIcon } from "@/components/icons/TradeApplicationIcon";
import { RequiredActionIcon } from "@/components/icons/RequiredActionIcon";
import { PortfolioIcon } from "@/components/icons/PortfolioIcon";
import { NotificationBellIcon } from "@/components/icons/NotificationBellIcon";

type NotificationIconCategory = "trade" | "action" | "settlement" | "default";

const ACTION_TYPES = new Set([
  "KYC_SUBMITTED",
  "CEO_REVIEW_REQUIRED",
  "CEO_ESCALATION",
  "CEO_VALIDATION_REQUIRED",
  "FP_INFO_REQUEST",
  "KYC_VERIFIED",
  "KYC_REJECTED",
]);

const SETTLEMENT_TYPES = new Set([
  "SETTLEMENT_INITIATED",
  "PAYMENT_RECORDED",
  "TRADE_SETTLED",
]);

const TRADE_TYPES = new Set([
  "TRADE_SUBMITTED",
  "TRADE_VALIDATED",
  "VALIDATION_COMPLETE",
  "TRADE_DECLINED",
  "TRADE_CLOSED",
  "DELIVERY_CONFIRMED",
  "DEPLOYMENT_COMPLETE",
  "STAGE_UPDATE",
  "RISK_UPDATE",
  "CEO_APPROVED",
  "CEO_DECLINED",
  "FP_APPROVED",
  "FP_DECLINED",
]);

function matchesActionSubject(subject: string): boolean {
  return /action required|approval required|requires additional|requesting more information|kyc submitted|high risk.*ceo|verification (approved|update)/i.test(
    subject
  );
}

function matchesSettlementSubject(subject: string): boolean {
  return /settlement|payment recorded|buyer payment/i.test(subject);
}

function matchesTradeSubject(subject: string): boolean {
  return /trade|risk score|capital deployment|goods delivery|procurement|funding confirmed|validated|declined by/i.test(
    subject
  );
}

export function getNotificationIconCategory(
  notification: Pick<Notification, "type" | "subject">
): NotificationIconCategory {
  const type = (notification.type || "").toUpperCase();
  const subject = notification.subject || "";

  if (ACTION_TYPES.has(type) || matchesActionSubject(subject)) {
    return "action";
  }

  if (SETTLEMENT_TYPES.has(type) || matchesSettlementSubject(subject)) {
    return "settlement";
  }

  if (TRADE_TYPES.has(type) || matchesTradeSubject(subject)) {
    return "trade";
  }

  return "default";
}

export function NotificationTypeIcon({
  notification,
  size = 18,
  strokeWidth = 2,
  style,
}: {
  notification: Pick<Notification, "type" | "subject">;
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  const category = getNotificationIconCategory(notification);

  switch (category) {
    case "trade":
      return <TradeApplicationIcon size={size} strokeWidth={strokeWidth} style={style} />;
    case "action":
      return <RequiredActionIcon size={size} style={style} />;
    case "settlement":
      return <PortfolioIcon size={size} strokeWidth={strokeWidth} style={style} />;
    default:
      return <NotificationBellIcon size={size} strokeWidth={strokeWidth} style={style} />;
  }
}
