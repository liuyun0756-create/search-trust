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
  page_url: string;
  page_type: string | null;
  gbp_url: string | null;
  task_id: string | null;
  status: "free_preview" | "paid_full";
  trust_status: string | null;
  ranking_potential: string | null;
  risk_level: string | null;
  generated_at: string | null;
  module_1_overview: Record<string, any> | null;
  module_2_page_level: Record<string, any> | null;
  module_3_key_problems: Record<string, any> | null;
  module_4_eight_layers: Record<string, any> | null;
  module_5_optimization: Record<string, any> | null;
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
  page_url: string;
  page_type: string;
  gbp_url: string | null;
  task_id: string;
  created_at: string;
  trust_status: string | null;
  ranking_potential: string | null;
  risk_level: string | null;
  module_1_overview: Record<string, any>;
  module_2_page_level: Record<string, any>;
  module_3_key_problems: Record<string, any>;
  module_4_eight_layers: Record<string, any>;
  module_5_optimization: Record<string, any>;
};
