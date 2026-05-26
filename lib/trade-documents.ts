export type TradeDocSpec = {
  key: string;
  label: string;
  required: boolean;
  hint: string;
};

export const TRADE_DOC_SPECS: TradeDocSpec[] = [
  { key: 'purchase_order', label: 'Purchase Order / Offtake Contract', required: true, hint: 'Signed buyer contract or PO' },
  { key: 'export_license', label: 'Export Licence', required: true, hint: 'Valid Ghana export authorization' },
  { key: 'bank_statement', label: 'Bank Statement / Payment Proof', required: true, hint: 'Recent statement for equity verification' },
  { key: 'bill_of_lading', label: 'Bill of Lading', required: false, hint: 'Required once shipment is arranged' },
  { key: 'quality_certificate', label: 'Quality Certificate', required: false, hint: 'Lab or inspection certificate' },
  { key: 'supporting', label: 'Other Supporting Document', required: false, hint: 'Any additional files for the deal team' },
];

export const REQUIRED_TRADE_DOC_TYPES = TRADE_DOC_SPECS.filter((s) => s.required).map((s) => s.key);

export type TradeDocumentRecord = {
  doc_type: string;
  name: string;
  storage_path?: string;
  status?: string;
  uploaded_at?: string;
  size_bytes?: number;
  url?: string | null;
};

export function matchTradeDocType(uploadedType: string, specKey: string): boolean {
  const t = (uploadedType || '').toLowerCase();
  const k = specKey.toLowerCase();
  return t === k || t.includes(k.replace(/_/g, '')) || t.includes(k);
}

export function normalizeTradeDocStatus(raw: string): 'accepted' | 'pending' | 'review' | 'rejected' {
  const s = (raw || '').toLowerCase();
  if (s === 'verified' || s === 'accepted') return 'accepted';
  if (s === 'rejected') return 'rejected';
  if (s === 'uploaded' || s === 'pending') return 'review';
  return 'pending';
}

export function getTradeDocSpecStatus(
  documents: TradeDocumentRecord[],
  spec: TradeDocSpec
): { status: 'accepted' | 'pending' | 'review' | 'rejected'; file: TradeDocumentRecord | null } {
  const match = documents.find((d) => matchTradeDocType(d.doc_type || d.name, spec.key));
  if (!match) return { status: 'pending', file: null };
  return { status: normalizeTradeDocStatus(match.status || 'uploaded'), file: match };
}

export function countMissingRequiredTradeDocs(documents: TradeDocumentRecord[]): number {
  return TRADE_DOC_SPECS.filter((s) => s.required).filter(
    (s) => getTradeDocSpecStatus(documents, s).status === 'pending'
  ).length;
}

export function hasAllRequiredTradeDocs(documents: TradeDocumentRecord[]): boolean {
  return countMissingRequiredTradeDocs(documents) === 0;
}

export function missingRequiredTradeDocLabels(documents: TradeDocumentRecord[]): string[] {
  return TRADE_DOC_SPECS.filter((s) => s.required)
    .filter((s) => getTradeDocSpecStatus(documents, s).status === 'pending')
    .map((s) => s.label);
}
