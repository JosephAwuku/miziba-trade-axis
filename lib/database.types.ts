export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organisations: {
        Row: {
          id: string
          name: string
          type: 'miziba' | 'trader' | 'finance_partner' | 'buyer'
          country: string
          registration_no: string | null
          tin: string | null
          address: string | null
          phone: string | null
          email: string | null
          kyc_status: 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'FLAGGED' | 'REJECTED'
          kyc_verified_at: string | null
          kyc_verified_by: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: 'miziba' | 'trader' | 'finance_partner' | 'buyer'
          country?: string
          registration_no?: string | null
          tin?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          kyc_status?: 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'FLAGGED' | 'REJECTED'
          kyc_verified_at?: string | null
          kyc_verified_by?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: 'miziba' | 'trader' | 'finance_partner' | 'buyer'
          country?: string
          registration_no?: string | null
          tin?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          kyc_status?: 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'FLAGGED' | 'REJECTED'
          kyc_verified_at?: string | null
          kyc_verified_by?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          org_id: string
          email: string
          phone: string | null
          full_name: string
          role: 'deal_officer' | 'ceo' | 'cfo' | 'trader' | 'finance_partner' | 'ops_admin'
          password_hash: string
          totp_secret: string | null
          totp_enabled: boolean
          is_active: boolean
          failed_logins: number
          locked_until: string | null
          last_login_at: string | null
          password_reset_token: string | null
          password_reset_expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          email: string
          phone?: string | null
          full_name: string
          role: 'deal_officer' | 'ceo' | 'cfo' | 'trader' | 'finance_partner' | 'ops_admin'
          password_hash: string
          totp_secret?: string | null
          totp_enabled?: boolean
          is_active?: boolean
          failed_logins?: number
          locked_until?: string | null
          last_login_at?: string | null
          password_reset_token?: string | null
          password_reset_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          email?: string
          phone?: string | null
          full_name?: string
          role?: 'deal_officer' | 'ceo' | 'cfo' | 'trader' | 'finance_partner' | 'ops_admin'
          password_hash?: string
          totp_secret?: string | null
          totp_enabled?: boolean
          is_active?: boolean
          failed_logins?: number
          locked_until?: string | null
          last_login_at?: string | null
          password_reset_token?: string | null
          password_reset_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      trades: {
        Row: {
          id: string
          trade_ref: string
          trader_org_id: string
          buyer_id: string
          fp_org_id: string | null
          deal_officer_id: string | null
          commodity: 'cashew' | 'shea' | 'sesame' | 'sorghum' | 'soya'
          grade: 'A' | 'B' | 'C'
          volume_mt: number
          price_per_mt_usd: number
          contract_value_usd: number
          procurement_cost_usd: number
          trader_equity_usd: number
          finance_facility_usd: number
          trader_equity_pct: number
          miziba_struct_fee_usd: number
          miziba_settle_fee_usd: number | null
          delivery_point: string
          deadline_date: string
          payment_terms_days: number
          stage: 'SUBMITTED' | 'UNDER_VALIDATION' | 'VALIDATED' | 'FINANCE_REVIEW' | 'FUNDED' | 'PROCURING' | 'DELIVERED' | 'SETTLED' | 'CLOSED'
          kyc_status: 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'FLAGGED' | 'REJECTED'
          risk_score: number | null
          escrow_id: string | null
          shipment_id: string | null
          is_multi_tranche: boolean
          capital_deployed_pct: number
          volume_procured_mt: number
          eudr_compliance_pct: number | null
          grade_a_pct: number | null
          grade_b_pct: number | null
          grade_c_pct: number | null
          delivered_weight_mt: number | null
          weight_variance_pct: number | null
          buyer_payment_usd: number | null
          buyer_payment_date: string | null
          settlement_status: 'PENDING' | 'INSTRUCTED' | 'CONFIRMED' | 'FAILED'
          declined_at: string | null
          declined_by: string | null
          decline_reason: string | null
          applied_at: string
          validated_at: string | null
          funded_at: string | null
          delivered_at: string | null
          settled_at: string | null
          closed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          trade_ref?: string
          trader_org_id: string
          buyer_id: string
          fp_org_id?: string | null
          deal_officer_id?: string | null
          commodity: 'cashew' | 'shea' | 'sesame' | 'sorghum' | 'soya'
          grade?: 'A' | 'B' | 'C'
          volume_mt: number
          price_per_mt_usd: number
          contract_value_usd?: number
          procurement_cost_usd: number
          trader_equity_usd: number
          finance_facility_usd: number
          trader_equity_pct?: number
          miziba_struct_fee_usd?: number
          miziba_settle_fee_usd?: number | null
          delivery_point: string
          deadline_date: string
          payment_terms_days?: number
          stage?: 'SUBMITTED' | 'UNDER_VALIDATION' | 'VALIDATED' | 'FINANCE_REVIEW' | 'FUNDED' | 'PROCURING' | 'DELIVERED' | 'SETTLED' | 'CLOSED'
          kyc_status?: 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'FLAGGED' | 'REJECTED'
          risk_score?: number | null
          escrow_id?: string | null
          shipment_id?: string | null
          is_multi_tranche?: boolean
          capital_deployed_pct?: number
          volume_procured_mt?: number
          eudr_compliance_pct?: number | null
          grade_a_pct?: number | null
          grade_b_pct?: number | null
          grade_c_pct?: number | null
          delivered_weight_mt?: number | null
          weight_variance_pct?: number | null
          buyer_payment_usd?: number | null
          buyer_payment_date?: string | null
          settlement_status?: 'PENDING' | 'INSTRUCTED' | 'CONFIRMED' | 'FAILED'
          declined_at?: string | null
          declined_by?: string | null
          decline_reason?: string | null
          applied_at?: string
          validated_at?: string | null
          funded_at?: string | null
          delivered_at?: string | null
          settled_at?: string | null
          closed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          trade_ref?: string
          trader_org_id?: string
          buyer_id?: string
          fp_org_id?: string | null
          deal_officer_id?: string | null
          commodity?: 'cashew' | 'shea' | 'sesame' | 'sorghum' | 'soya'
          grade?: 'A' | 'B' | 'C'
          volume_mt?: number
          price_per_mt_usd?: number
          contract_value_usd?: number
          procurement_cost_usd?: number
          trader_equity_usd?: number
          finance_facility_usd?: number
          trader_equity_pct?: number
          miziba_struct_fee_usd?: number
          miziba_settle_fee_usd?: number | null
          delivery_point?: string
          deadline_date?: string
          payment_terms_days?: number
          stage?: 'SUBMITTED' | 'UNDER_VALIDATION' | 'VALIDATED' | 'FINANCE_REVIEW' | 'FUNDED' | 'PROCURING' | 'DELIVERED' | 'SETTLED' | 'CLOSED'
          kyc_status?: 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'FLAGGED' | 'REJECTED'
          risk_score?: number | null
          escrow_id?: string | null
          shipment_id?: string | null
          is_multi_tranche?: boolean
          capital_deployed_pct?: number
          volume_procured_mt?: number
          eudr_compliance_pct?: number | null
          grade_a_pct?: number | null
          grade_b_pct?: number | null
          grade_c_pct?: number | null
          delivered_weight_mt?: number | null
          weight_variance_pct?: number | null
          buyer_payment_usd?: number | null
          buyer_payment_date?: string | null
          settlement_status?: 'PENDING' | 'INSTRUCTED' | 'CONFIRMED' | 'FAILED'
          declined_at?: string | null
          declined_by?: string | null
          decline_reason?: string | null
          applied_at?: string
          validated_at?: string | null
          funded_at?: string | null
          delivered_at?: string | null
          settled_at?: string | null
          closed_at?: string | null
          updated_at?: string
        }
      }
      trade_validations: {
        Row: {
          id: string
          trade_id: string
          buyer_verified: boolean
          buyer_notes: string | null
          price_reasonable: boolean
          price_notes: string | null
          sourcing_feasible: boolean
          sourcing_notes: string | null
          trader_qualified: boolean
          trader_notes: string | null
          margin_viable: boolean
          margin_notes: string | null
          decision: 'validated' | 'declined' | 'referred' | null
          decline_reason: string | null
          validated_by: string | null
          ceo_approved_by: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trade_id: string
          buyer_verified?: boolean
          buyer_notes?: string | null
          price_reasonable?: boolean
          price_notes?: string | null
          sourcing_feasible?: boolean
          sourcing_notes?: string | null
          trader_qualified?: boolean
          trader_notes?: string | null
          margin_viable?: boolean
          margin_notes?: string | null
          decision?: 'validated' | 'declined' | 'referred' | null
          decline_reason?: string | null
          validated_by?: string | null
          ceo_approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trade_id?: string
          buyer_verified?: boolean
          buyer_notes?: string | null
          price_reasonable?: boolean
          price_notes?: string | null
          sourcing_feasible?: boolean
          sourcing_notes?: string | null
          trader_qualified?: boolean
          trader_notes?: string | null
          margin_viable?: boolean
          margin_notes?: string | null
          decision?: 'validated' | 'declined' | 'referred' | null
          decline_reason?: string | null
          validated_by?: string | null
          ceo_approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      trade_risk_scores: {
         Row: {
          id: string
          trade_id: string
          buyer_risk: number
          trader_risk: number
          commodity_price_risk: number
          sourcing_supply_risk: number
          logistics_delivery_risk: number
          total_score: number
          scored_by: string
          scored_at: string
          notes: string | null
        }
        Insert: {
          id?: string
          trade_id: string
          buyer_risk: number
          trader_risk: number
          commodity_price_risk: number
          sourcing_supply_risk: number
          logistics_delivery_risk: number
          scored_by: string
          scored_at?: string
          notes?: string | null
        }
        Update: {
          id?: string
          trade_id?: string
          buyer_risk?: number
          trader_risk?: number
          commodity_price_risk?: number
          sourcing_supply_risk?: number
          logistics_delivery_risk?: number
          scored_by?: string
          scored_at?: string
          notes?: string | null
        }
      }
      buyers: {
        Row: {
          id: string
          name: string
          country: string
          registration_no: string | null
          sanctions_clear: boolean
          sanctions_checked_at: string | null
          trades_completed: number
          trades_on_time: number
          trades_late: number
          avg_days_late: number | null
          disputes: number
          creditworthiness_score: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          country: string
          registration_no?: string | null
          sanctions_clear?: boolean
          sanctions_checked_at?: string | null
          trades_completed?: number
          trades_on_time?: number
          trades_late?: number
          avg_days_late?: number | null
          disputes?: number
          creditworthiness_score?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          country?: string
          registration_no?: string | null
          sanctions_clear?: boolean
          sanctions_checked_at?: string | null
          trades_completed?: number
          trades_on_time?: number
          trades_late?: number
          avg_days_late?: number | null
          disputes?: number
          creditworthiness_score?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
