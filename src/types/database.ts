export interface User {
  id: string;
  clerk_user_id: string;
  email: string;
  name: string | null;
  audit_credits: number;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  report_id: string;
  user_id: string;
  url: string;
  page_type: string | null;
  gbp_url: string | null;
  status: "free_preview" | "paid_full";
  trust_status: string | null;
  trust_status_desc: string | null;
  ranking_potential: string | null;
  ranking_potential_desc: string | null;
  risk_level: string | null;
  risk_level_desc: string | null;
  stage_1_html: string | null;
  stage_2_html: string | null;
  stage_3_html: string | null;
  stage_4_html: string | null;
  stage_5_html: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  order_id: string;
  amount: number;
  credits_purchased: number;
  status: "pending" | "paid" | "failed" | "refunded";
  created_at: string;
  paid_at: string | null;
}

export type GenerateReportRequest = {
  url: string;
  page_type: string;
  gbp_url?: string;
};

export type GenerateReportResponse = {
  report_id: string;
  url: string;
  page_type: string;
  gbp_url: string | null;
  created_at: string;
  trust_status: string;
  trust_status_desc: string;
  ranking_potential: string;
  ranking_potential_desc: string;
  risk_level: string;
  risk_level_desc: string;
  stage_1_html: string;
  stage_2_html: string;
  stage_3_html: string;
  stage_4_html: string;
  stage_5_html: string;
};
