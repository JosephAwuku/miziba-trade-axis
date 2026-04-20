/**
 * API client functions for TradeAxis frontend
 */

import { TradeSummary, TradeApplicationInput, User, ValidationChecklist, RiskAssessment, FinanceDataPackage, SettlementData, Notification } from './types';

const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }

    return response.json();
  }

  async getPortfolioMetrics(): Promise<any> {
    return this.request<any>('/portfolio');
  }

  async getBuyers(): Promise<any[]> {
    return this.request<any[]>('/portfolio/buyers');
  }

  // Auth
  async login(email: string, password: string, totpCode?: string) {
    return this.request<{
      token: string;
      expires_at: string;
      user: User;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, totp_code: totpCode }),
    });
  }

  async getMe() {
    return this.request<User>('/auth/me');
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

  async updateTrade(id: string, updates: any) {
    return this.request<{ trade: TradeSummary }>(`/trades/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // Validation methods
  async getValidationChecklist(tradeId: string) {
    return this.request<{
      trade_id: string;
      checklist: ValidationChecklist;
      overall_progress: number;
    }>(`/trades/${tradeId}/validation`);
  }

  async updateValidationItem(tradeId: string, section: string, itemId: string, completed: boolean) {
    return this.request<{
      success: boolean;
      validation: any;
      message: string;
    }>(`/trades/${tradeId}/validation`, {
      method: 'PATCH',
      body: JSON.stringify({ section, item_id: itemId, completed }),
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
    action: 'initiate' | 'record_payment';
    payment_amount?: number;
    payment_date?: string;
    notes?: string;
  }) {
    return this.request<{
      success: boolean;
      settlement: SettlementData;
      progress: any;
    }>(`/trades/${tradeId}/settlement`, {
      method: 'POST',
      body: JSON.stringify(data),
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
    return this.request<{ success: boolean; user: any }>('/admin/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUsers() {
    return this.request<{ data: any[] }>('/admin/users');
  }

  async getPendingTraders() {
    return this.request<any[]>('/admin/traders/pending');
  }

  async verifyTrader(orgId: string, decision: 'VERIFIED' | 'REJECTED', notes?: string) {
    return this.request<{ success: boolean }>('/admin/verify', {
      method: 'POST',
      body: JSON.stringify({ org_id: orgId, decision, notes }),
    });
  }

  async submitTraderVerification(data: any) {
    return this.request<{ success: boolean }>('/trader/onboard', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient();