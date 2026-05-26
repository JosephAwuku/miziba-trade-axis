/**
 * API client functions for TradeAxis frontend
 */

import { TradeSummary, TradeApplicationInput, User, ValidationChecklist, RiskAssessment, FinanceDataPackage, SettlementData, Notification } from './types';
import { ApiError } from './api-errors';

const API_BASE = '/api';

/** 401 on these routes means wrong credentials / onboarding step — not “kill the session”. */
const AUTH_NO_EXPIRE_ON_401 = new Set([
  '/auth/login',
  '/auth/change-password',
  '/auth/2fa/setup',
  '/auth/2fa/verify',
]);

class ApiClient {
  private token: string | null = null;
  private refreshPromise: Promise<void> | null = null;
  private refreshFailed = false;
  private onSessionExpired: (() => void) | null = null;

  setToken(token: string) {
    this.token = token;
    // A new token means any previous refresh failure is cleared.
    this.refreshFailed = false;
  }

  setOnSessionExpired(cb: () => void) {
    this.onSessionExpired = cb;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  private handleExpiredSession() {
    this.token = null;
    this.refreshFailed = true;
    this.refreshPromise = null;
    try {
      localStorage.removeItem('tradeaxis_session');
    } catch {
      // localStorage may not be available in SSR
    }
    this.onSessionExpired?.();
  }

  private getTokenExpiryMs(token: string): number | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload?.exp ? Number(payload.exp) * 1000 : null;
    } catch {
      return null;
    }
  }

  private async ensureFreshToken() {
    if (!this.token || this.token.startsWith('mock-token')) return;

    // If a previous refresh already failed, don't hammer the endpoint again.
    // The session-expired callback will have already logged the user out.
    if (this.refreshFailed) return;

    const expiryMs = this.getTokenExpiryMs(this.token);
    if (!expiryMs) return;

    const now = Date.now();

    // Token already fully expired — no point trying to refresh, log out immediately.
    if (now >= expiryMs) {
      this.handleExpiredSession();
      return;
    }

    // Proactively refresh 5 minutes before expiry.
    const shouldRefresh = now >= expiryMs - 5 * 60 * 1000;
    if (!shouldRefresh) return;

    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
        });

        if (!res.ok) {
          this.handleExpiredSession();
          throw new Error('SESSION_EXPIRED');
        }

        const data = await res.json();
        if (data?.token) {
          this.token = data.token;
          try {
            const saved = localStorage.getItem('tradeaxis_session');
            if (saved) {
              const session = JSON.parse(saved);
              localStorage.setItem('tradeaxis_session', JSON.stringify({
                ...session,
                token: data.token,
                expires_at: data.expires_at,
              }));
            }
          } catch {
            // localStorage may not be available in SSR
          }
        }
      })().finally(() => {
        this.refreshPromise = null;
      });
    }

    await this.refreshPromise;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    await this.ensureFreshToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.token && this.token.startsWith('mock-token')) {
      const role = this.token.includes(':') ? this.token.split(':')[1] : 'ceo';
      const method = options.method || 'GET';
      
      console.log(`[Dev] Mocking API request: ${method} ${endpoint} for role: ${role}`);
      
      // Only mock GET requests; let POST/PATCH/DELETE through to backend or fail naturally
      if (method === 'GET') {
        if (endpoint === '/auth/me') {
          return {
            id: `test-${role}`,
            email: `${role}@miziba.com`,
            full_name: `Test ${role.toUpperCase()}`,
            role: role,
            org_id: 'org-test',
            org_name: 'Miziba Capital'
          } as any;
        }
        if (endpoint.startsWith('/trades')) {
          return {
            data: [],
            total: 0,
            page: 1,
            per_page: 10
          } as any;
        }
        if (endpoint === '/portfolio') {
          return {
            total_contract_value_usd: 0,
            total_facility_usd: 0,
            avg_risk_score: 0,
            total_volume_mt: 0,
            countries_active: 0,
            farmers_reached: 0,
            stage_distribution: {},
            commodity_breakdown: {},
            total_deals: 0,
            avg_trade_cycle_days: 0,
            farmer_sla_compliance_pct: 0,
            weight_reconciliation_pct: 0
          } as any;
        }
        if (endpoint === '/notifications') return [] as any;
      }
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      if (response.status === 401) {
        if (AUTH_NO_EXPIRE_ON_401.has(endpoint)) {
          const msg =
            typeof errorBody.message === 'string'
              ? errorBody.message
              : typeof errorBody.error === 'string'
                ? errorBody.error
                : 'Authentication failed.';
          throw new Error(msg);
        }
        this.handleExpiredSession();
        throw new Error('SESSION_EXPIRED');
      }
      const message =
        typeof errorBody.message === 'string'
          ? errorBody.message
          : typeof errorBody.error === 'string'
            ? errorBody.error
            : `API request failed with status ${response.status}`;
      throw new ApiError(message, {
        code: typeof errorBody.error === 'string' ? errorBody.error : undefined,
        guards: errorBody.guards,
        status: response.status,
      });
    }

    return response.json();
  }

  async getPortfolioMetrics(): Promise<any> {
    return this.request<any>('/portfolio');
  }

  async getBuyers(search?: string): Promise<any[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<any[]>(`/portfolio/buyers${query}`);
  }

  async addBuyer(data: any) {
    return this.request<{ success: boolean; buyer: any }>('/portfolio/buyers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteBuyer(id: string) {
    return this.request<{ success: boolean }>('/portfolio/buyers', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  }

  async getBuyer(id: string) {
    return this.request<{ data: Record<string, unknown> }>(`/portfolio/buyers/${id}`);
  }

  async updateBuyer(id: string, body: Record<string, unknown>) {
    return this.request<{ success: boolean; data: Record<string, unknown> }>(`/portfolio/buyers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  // Aggregators
  async getAggregators(search?: string): Promise<any[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<any[]>(`/portfolio/aggregators${query}`);
  }

  async addAggregator(data: any) {
    return this.request<{ success: boolean; aggregator: any }>('/portfolio/aggregators', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteAggregator(id: string) {
    return this.request<{ success: boolean }>('/portfolio/aggregators', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  }

  async getAggregator(id: string) {
    return this.request<{ data: Record<string, unknown> }>(`/portfolio/aggregators/${id}`);
  }

  async updateAggregator(id: string, body: Record<string, unknown>) {
    return this.request<{ success: boolean; data: Record<string, unknown> }>(`/portfolio/aggregators/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  // Auth
  async login(email: string, password: string, totpCode?: string) {
    return this.request<{
      next_step: 'DONE' | 'PASSWORD_CHANGE_REQUIRED' | 'MFA_SETUP_REQUIRED' | 'MFA_CODE_REQUIRED';
      token?: string;
      onboarding_token?: string;
      expires_at?: string;
      user: User;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, totp_code: totpCode }),
    });
  }

  async changePassword(newPassword: string, onboardingToken: string) {
    return this.request<{
      next_step: string;
      onboarding_token?: string;
      user: User;
    }>('/auth/change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${onboardingToken}` },
      body: JSON.stringify({ new_password: newPassword }),
    });
  }

  async getMe() {
    return this.request<User>('/auth/me');
  }

  // Self-service 2FA — no target user params
  async setup2FA(onboardingToken?: string) {
    const headers: Record<string, string> = {};
    if (onboardingToken) headers['Authorization'] = `Bearer ${onboardingToken}`;
    return this.request<{
      success: boolean;
      otpauth_url: string;
      qr_code_data_url: string;
      message: string;
    }>('/auth/2fa/setup', {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
  }

  async verify2FA(totpCode: string, onboardingToken?: string) {
    const headers: Record<string, string> = {};
    if (onboardingToken) headers['Authorization'] = `Bearer ${onboardingToken}`;
    return this.request<{
      next_step: 'DONE';
      token: string;
      expires_at: string;
      user: User;
    }>('/auth/2fa/verify', {
      method: 'POST',
      headers,
      body: JSON.stringify({ totp_code: totpCode }),
    });
  }

  // Admin emergency actions (never exposes secrets)
  async unlockUser(data: { user_id?: string; email?: string }) {
    return this.request<{ success: boolean; message: string }>('/admin/users/unlock', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resetUserMfa(data: { user_id?: string; email?: string }) {
    return this.request<{ success: boolean; message: string }>('/admin/users/reset-mfa', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Notifications
  async getNotifications() {
    return this.request<Notification[]>('/notifications');
  }

  async markNotificationRead(id: string | 'all') {
    return this.request<{ success: boolean }>('/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ id }),
    });
  }

  // Trades
  async getTrades(params?: {
    stage?: string[];
    commodity?: string;
    fp_org_id?: string;
    trader_org_id?: string;
    from_date?: string;
    to_date?: string;
    page?: number;
    per_page?: number;
    search?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.stage) searchParams.set('stage', params.stage.join(','));
    if (params?.commodity) searchParams.set('commodity', params.commodity);
    if (params?.fp_org_id) searchParams.set('fp_org_id', params.fp_org_id);
    if (params?.trader_org_id) searchParams.set('trader_org_id', params.trader_org_id);
    if (params?.from_date) searchParams.set('from_date', params.from_date);
    if (params?.to_date) searchParams.set('to_date', params.to_date);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.search) searchParams.set('search', params.search);

    return this.request<{
      data: TradeSummary[];
      total: number;
      page: number;
      per_page: number;
    }>(`/trades?${searchParams.toString()}`);
  }

  async createTrade(trade: TradeApplicationInput) {
    return this.request('/trades', {
      method: 'POST',
      body: JSON.stringify(trade),
    });
  }

  async getTrade(id: string) {
    return this.request<{ trade: TradeSummary }>(`/trades/${id}`);
  }

  async updateTrade(id: string, updates: Record<string, unknown>) {
    return this.request<{ trade: TradeSummary }>(`/trades/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /** Advance stage with guard-aware error messages */
  async advanceTradeStage(id: string, stage: string) {
    return this.updateTrade(id, { stage });
  }

  // Validation methods
  async getValidationChecklist(tradeId: string) {
    return this.request<{
      trade_id: string;
      checklist: ValidationChecklist;
      overall_progress: number;
    }>(`/trades/${tradeId}/validation`);
  }

  async updateValidationItem(tradeId: string, section: string, itemId: string, completed: boolean, notes?: string) {
    return this.request<{
      success: boolean;
      validation: any;
      message: string;
    }>(`/trades/${tradeId}/validation`, {
      method: 'PATCH',
      body: JSON.stringify({ section, item_id: itemId, completed, notes }),
    });
  }

  // Risk methods
  async getRiskAssessment(tradeId: string) {
    return this.request<{
      trade_id: string;
      risk_score: number;
      breakdown: any;
      factors: any[];
      calculated_at: string;
      recommendations: string[];
    }>(`/trades/${tradeId}/risk`);
  }

  async createRiskAssessment(tradeId: string, data: { risk_score: number; breakdown: any }) {
    return this.request<{
      success: boolean;
      assessment: RiskAssessment;
      recommendations: string[];
    }>(`/trades/${tradeId}/risk`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // FDP methods
  async getFinanceDataPackage(tradeId: string) {
    return this.request<{
      trade_id: string;
      fdp: FinanceDataPackage;
      waterfall_summary: any;
    }>(`/trades/${tradeId}/fdp`);
  }

  async generateFinanceDataPackage(tradeId: string, data: { status?: string; notes?: string }) {
    return this.request<{
      success: boolean;
      fdp: FinanceDataPackage;
      waterfall_summary: any;
      message?: string;
      advanced_to_finance_review?: boolean;
      requires_ceo_approval?: boolean;
    }>(`/trades/${tradeId}/fdp`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Settlement methods
  async getSettlementData(tradeId: string) {
    return this.request<{
      trade_id: string;
      settlement?: SettlementData;
      progress?: any;
      waterfall_instructions?: any[];
      status: string;
      message?: string;
    }>(`/trades/${tradeId}/settlement`);
  }

  async updateSettlement(tradeId: string, data: {
    action: 'initiate' | 'record_payment' | 'sign';
    payment_amount?: number;
    payment_date?: string;
    notes?: string;
  }) {
    return this.request<{
      success: boolean;
      settlement: SettlementData;
      progress: any;
      advanced_to_settled?: boolean;
    }>(`/trades/${tradeId}/settlement`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Finance Partner decision
  async getFpDecisions(tradeId: string) {
    return this.request<{ decisions: Array<{ decision: string; decided_at: string; notes?: string }> }>(
      `/trades/${tradeId}/fp-decision`
    );
  }

  async submitFpDecision(
    tradeId: string,
    data: { decision: 'approve' | 'decline' | 'info_request'; notes?: string; info_request?: string }
  ) {
    return this.request<{
      success: boolean;
      decision: unknown;
      message: string;
    }>(`/trades/${tradeId}/fp-decision`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // CEO escalation
  async getCeoEscalation(tradeId: string) {
    return this.request<{
      escalation: { decision?: string; notes?: string; decided_at?: string } | null;
      requires_ceo_approval: boolean;
    }>(`/trades/${tradeId}/ceo-decision`);
  }

  async submitCeoDecision(
    tradeId: string,
    data: { decision: 'approve_direct' | 'require_validation' | 'decline'; notes?: string }
  ) {
    return this.request<{ success: boolean; decision: unknown; message: string }>(
      `/trades/${tradeId}/ceo-decision`,
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  // Capital deployment
  async getDeploymentStatus(tradeId: string) {
    return this.request<{
      capital_deployed_pct: number;
      can_advance_to_procuring: boolean;
    }>(`/trades/${tradeId}/deployment`);
  }

  async updateDeployment(tradeId: string, capital_deployed_pct: number) {
    return this.request<{
      success: boolean;
      capital_deployed_pct: number;
      can_advance_to_procuring: boolean;
      message: string;
    }>(`/trades/${tradeId}/deployment`, {
      method: 'PATCH',
      body: JSON.stringify({ capital_deployed_pct }),
    });
  }

  // Delivery confirmation
  async getDeliveryStatus(tradeId: string) {
    return this.request<{
      delivered_weight_mt: number;
      expected_weight_mt: number;
      weight_variance_pct: number;
      delivered_at?: string;
      can_advance_to_delivered: boolean;
    }>(`/trades/${tradeId}/delivery`);
  }

  async confirmDelivery(
    tradeId: string,
    data: {
      delivered_weight_mt: number;
      volume_procured_mt?: number;
      grade_a_pct?: number;
      grade_b_pct?: number;
      grade_c_pct?: number;
    }
  ) {
    return this.request<{
      success: boolean;
      delivered_weight_mt: number;
      weight_variance_pct: number;
      can_advance_to_delivered: boolean;
      message: string;
    }>(`/trades/${tradeId}/delivery`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Closure checklist
  async getClosureChecklist(tradeId: string) {
    return this.request<{
      trade_id: string;
      checklist: Record<string, boolean>;
      can_close: boolean;
      completed_items: number;
      total_items: number;
      locked_at?: string;
    }>(`/trades/${tradeId}/closure`);
  }

  async updateClosureChecklist(tradeId: string, updates: Record<string, boolean>) {
    return this.request<{
      success: boolean;
      can_close: boolean;
      completed_items: number;
      total_items: number;
      message: string;
    }>(`/trades/${tradeId}/closure`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // Document methods
  async getTradeDocuments(tradeId: string) {
    return this.request<{
      trade_id: string;
      documents: any[];
    }>(`/trades/${tradeId}/documents`);
  }

  async getTradeTimeline(tradeId: string) {
    return this.request<any[]>(`/trades/${tradeId}/timeline`);
  }

  async uploadDocument(tradeId: string, formData: FormData) {
    const headers: HeadersInit = {};
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}/trades/${tradeId}/documents`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }

    return response.json();
  }

  // Admin / Onboarding
  async inviteTrader(data: { name: string; email: string; org_name: string; role?: string; temp_password?: string }) {
    return this.request<{
      success: boolean;
      user: any;
      email_delivery?: {
        sent: boolean;
        skipped?: boolean;
        error?: string;
        resend_id?: string;
      };
    }>('/admin/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUsers() {
    return this.request<{ data: any[]; meta?: { source?: string; endpoint?: string } }>('/admin/users');
  }

  async getAdminUser(userId: string) {
    return this.request<{
      data: {
        id: string;
        full_name: string;
        email: string;
        phone: string;
        role: string;
        is_active: boolean;
        org_id: string | null;
        org_name: string;
        kyc_status: string | null;
        totp_enabled: boolean;
        must_change_password: boolean;
        locked_until: string | null;
        admin_added_at: string | null;
      };
    }>(`/admin/users/${userId}`);
  }

  async updateAdminUser(
    userId: string,
    body: {
      full_name?: string;
      email?: string;
      phone?: string | null;
      is_active?: boolean;
      org_name?: string;
    }
  ) {
    return this.request<{ success: boolean; message?: string }>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  /** Permanently deletes the user (and dedicated trader/partner org when safe). */
  async deleteAdminUser(userId: string) {
    return this.request<{ success: boolean; message?: string }>(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async getAuditLogs(params?: {
    page?: number;
    per_page?: number;
    action?: string;
    trade_id?: string;
    user_id?: string;
    search?: string;
    from_date?: string;
    to_date?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.per_page) searchParams.set('per_page', String(params.per_page));
    if (params?.action) searchParams.set('action', params.action);
    if (params?.trade_id) searchParams.set('trade_id', params.trade_id);
    if (params?.user_id) searchParams.set('user_id', params.user_id);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.from_date) searchParams.set('from_date', params.from_date);
    if (params?.to_date) searchParams.set('to_date', params.to_date);
    const q = searchParams.toString();
    return this.request<{
      data: Array<{
        id: string;
        user_name: string;
        user_role?: string;
        action: string;
        entity_type: string;
        trade_id?: string;
        trade_ref?: string;
        occurred_at: string;
        new_value?: { stage?: string; risk?: number };
      }>;
      total: number;
      page: number;
      per_page: number;
    }>(`/admin/audit-log${q ? `?${q}` : ''}`);
  }

  async getAdminDashboard() {
    return this.request<{
      pending_verifications: number;
      total_users: number;
      active_users: number;
      failed_webhooks: number;
      activities: Array<{
        id: string;
        kind: 'user' | 'audit' | 'webhook';
        title: string;
        subtitle: string;
        timestamp: string;
      }>;
      source: string;
    }>('/admin/dashboard');
  }

  async getPendingTraders() {
    return this.request<any[]>('/admin/traders/pending');
  }

  async sendKycReminders(daysPending = 3) {
    return this.request<{
      success: boolean;
      message: string;
      days_pending: number;
      results: { org_id: string; name: string; sent: boolean }[];
    }>('/admin/kyc-reminders', {
      method: 'POST',
      body: JSON.stringify({ days_pending: daysPending }),
    });
  }

  async verifyTrader(orgId: string, decision: 'VERIFIED' | 'REJECTED', notes?: string) {
    return this.request<{ success: boolean }>('/admin/verify', {
      method: 'POST',
      body: JSON.stringify({ org_id: orgId, decision, notes }),
    });
  }

  /**
   * Granular KYC verification - approve/reject individual items
   * @param orgId - Trader organisation ID
   * @param target - What to verify: 'document', 'company_profile', 'bank_details', or 'full_verification'
   * @param decision - 'approve' or 'reject'
   * @param notes - Required when rejecting, shown to trader
   * @param documentId - Required when target is 'document'
   */
  async verifyKycItem(data: {
    org_id: string;
    target: 'document' | 'company_profile' | 'bank_details' | 'full_verification';
    decision: 'approve' | 'reject';
    notes?: string;
    document_id?: string;
  }) {
    return this.request<{
      success: boolean;
      message: string;
      kycStatus: string;
      isFullyVerified: boolean;
    }>('/admin/verify-item', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get comprehensive verification status for a trader
   */
  async getTraderVerificationStatus(orgId: string) {
    return this.request<{
      isFullyVerified: boolean;
      kyc_status: string;
      companyProfile: {
        isVerified: boolean;
        hasData: boolean;
        verifiedBy: string | null;
        verifiedAt: string | null;
        rejectionNotes: string | null;
      };
      bankDetails: {
        isVerified: boolean;
        hasData: boolean;
        verifiedBy: string | null;
        verifiedAt: string | null;
        rejectionNotes: string | null;
      };
      documents: Array<{
        id: string;
        docType: string;
        name: string;
        status: string;
        rejectionNotes: string | null;
        reviewedBy: string | null;
        reviewedAt: string | null;
      }>;
      requiredDocuments: {
        total: number;
        uploaded: number;
        verified: number;
        rejected: number;
        missing: string[];
      };
    }>(`/admin/traders/${orgId}/verification-status`);
  }

  async submitTraderVerification(data: any) {
    return this.request<{ success: boolean }>('/trader/onboard', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTraderProfile() {
    return this.request<any>('/trader/profile');
  }

  async getTraderProfileForAdmin(orgId: string) {
    return this.request<any>(`/admin/traders/${orgId}`);
  }

  async getTraderKycDocumentSignedUrl(orgId: string, docId: string) {
    return this.request<{ url: string; filename?: string }>(`/admin/traders/${orgId}/documents/${docId}`);
  }

  async getTraderCompanyDocumentSignedUrl(docId: string) {
    return this.request<{ url: string; filename?: string }>(`/trader/documents/${docId}`);
  }

  async uploadCompanyDocument(formData: FormData) {
    const headers: HeadersInit = {};
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}/trader/documents`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }

    return response.json();
  }

  // Finance Partner Onboarding
  async getFpOnboarding(): Promise<{
    onboarding_step: number;
    onboarding_done: boolean;
    framework_signed: boolean;
    portal_active: boolean;
    reviewer_name: string | null;
    approver_name: string | null;
    bank_name: string | null;
    bank_swift: string | null;
    next_interaction: string | null;
  }> {
    return this.request('/fp/onboarding');
  }

  async updateFpOnboarding(data: {
    step: number;
    framework_signed?: boolean;
    reviewer_name?: string;
    approver_name?: string;
    bank_name?: string;
    bank_swift?: string;
  }): Promise<{ success: boolean; onboarding_step: number; onboarding_done: boolean }> {
    return this.request('/fp/onboarding', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Draft trades
  async getDrafts() {
    return this.request<{ drafts: any[] }>('/drafts');
  }

  async getDraft(id: string) {
    return this.request<{ draft: any }>(`/drafts/${id}`);
  }

  async saveDraft(data: { draft_data: any; title?: string; last_edited_step?: number }) {
    return this.request<{ success: boolean; draft: any }>('/drafts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDraft(id: string, data: { draft_data?: any; title?: string; last_edited_step?: number }) {
    return this.request<{ success: boolean; draft: any }>(`/drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteDraft(id: string) {
    return this.request<{ success: boolean }>(`/drafts/${id}`, {
      method: 'DELETE',
    });
  }

  async getDraftDocuments(draftId: string) {
    return this.request<{ draft_id: string; documents: any[] }>(`/drafts/${draftId}/documents`);
  }

  async uploadDraftDocument(draftId: string, formData: FormData) {
    const headers: HeadersInit = {};
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}/drafts/${draftId}/documents`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }

    return response.json();
  }
}

export const apiClient = new ApiClient();