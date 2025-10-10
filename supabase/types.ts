export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      objectives: {
        Row: {
          id: string;
          tenant_id: string;
          created_by: string | null;
          goal: string;
          audience: string;
          timeframe: string | null;
          guardrails: Json;
          status: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          created_by?: string | null;
          goal: string;
          audience: string;
          timeframe?: string | null;
          guardrails?: Json;
          status?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['objectives']['Row']>;
        Relationships: [];
      };
      plays: {
        Row: {
          id: string;
          tenant_id: string;
          objective_id: string;
          mode: string;
          plan_json: Json;
          impact_estimate: string | null;
          risk_profile: string | null;
          undo_plan: string | null;
          confidence: number | null;
          latency_ms: number | null;
          success_score: number | null;
          tool_count: number | null;
          evidence_hash: string | null;
          telemetry: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          objective_id: string;
          mode?: string;
          plan_json?: Json;
          impact_estimate?: string | null;
          risk_profile?: string | null;
          undo_plan?: string | null;
          confidence?: number | null;
          latency_ms?: number | null;
          success_score?: number | null;
          tool_count?: number | null;
          evidence_hash?: string | null;
          telemetry?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['plays']['Row']>;
        Relationships: [];
      };
      tool_calls: {
        Row: {
          id: string;
          tenant_id: string;
          play_id: string;
          toolkit: string;
          tool_name: string;
          arguments: Json;
          arguments_hash: string;
          result_ref: string | null;
          outcome: Json | null;
          undo_plan: string | null;
          undo_plan_json: Json | null;
          guardrail_snapshot: Json | null;
          latency_ms: number | null;
          quiet_hour_override: boolean;
          executed_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          play_id: string;
          toolkit: string;
          tool_name: string;
          arguments?: Json;
          arguments_hash: string;
          result_ref?: string | null;
          outcome?: Json | null;
          undo_plan?: string | null;
          undo_plan_json?: Json | null;
          guardrail_snapshot?: Json | null;
          latency_ms?: number | null;
          quiet_hour_override?: boolean;
          executed_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tool_calls']['Row']>;
        Relationships: [];
      };
      approvals: {
        Row: {
          id: string;
          tenant_id: string;
          tool_call_id: string;
          reviewer_id: string | null;
          decision: string;
          decision_at: string;
          justification: string | null;
          guardrail_violation: Json | null;
          metadata: Json;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          tool_call_id: string;
          reviewer_id?: string | null;
          decision: string;
          decision_at?: string;
          justification?: string | null;
          guardrail_violation?: Json | null;
          metadata?: Json;
        };
        Update: Partial<Database['public']['Tables']['approvals']['Row']>;
        Relationships: [];
      };
      artifacts: {
        Row: {
          id: string;
          tenant_id: string;
          play_id: string | null;
          type: string;
          title: string;
          content_ref: string | null;
          content: Json | null;
          status: string;
          hash: string | null;
          checksum: string | null;
          size_bytes: number | null;
          reviewer_edits: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          play_id?: string | null;
          type: string;
          title: string;
          content_ref?: string | null;
          content?: Json | null;
          status?: string;
          hash?: string | null;
          checksum?: string | null;
          size_bytes?: number | null;
          reviewer_edits?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['artifacts']['Row']>;
        Relationships: [];
      };
      library_entries: {
        Row: {
          id: string;
          tenant_id: string;
          title: string;
          description: string | null;
          persona: string | null;
          embedding: unknown;
          success_score: number | null;
          reuse_count: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          title: string;
          description?: string | null;
          persona?: string | null;
          embedding: unknown;
          success_score?: number | null;
          reuse_count?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['library_entries']['Row']>;
        Relationships: [];
      };
      guardrail_profiles: {
        Row: {
          id: string;
          tenant_id: string;
          label: string;
          tone_policy: Json;
          quiet_hours: Json;
          rate_limit: Json;
          budget_cap: Json;
          undo_required: boolean;
          escalation_contacts: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          label: string;
          tone_policy?: Json;
          quiet_hours?: Json;
          rate_limit?: Json;
          budget_cap?: Json;
          undo_required?: boolean;
          escalation_contacts?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['guardrail_profiles']['Row']>;
        Relationships: [];
      };
      mission_guardrails: {
        Row: {
          mission_id: string;
          guardrail_profile_id: string;
          custom_overrides: Json | null;
          effective_at: string;
        };
        Insert: {
          mission_id: string;
          guardrail_profile_id: string;
          custom_overrides?: Json | null;
          effective_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mission_guardrails']['Row']>;
        Relationships: [];
      };
      copilot_sessions: {
        Row: {
          id: string;
          tenant_id: string;
          agent_id: string;
          session_identifier: string;
          state: Json;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          agent_id: string;
          session_identifier: string;
          state?: Json;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['copilot_sessions']['Row']>;
        Relationships: [];
      };
      copilot_messages: {
        Row: {
          id: string;
          tenant_id: string;
          session_id: string;
          mission_id: string | null;
          role: string;
          content: Json;
          metadata: Json;
          payload_type: string | null;
          latency_ms: number | null;
          telemetry_event_ids: string[] | null;
          created_at: string;
          soft_deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          session_id: string;
          mission_id?: string | null;
          role: string;
          content: Json;
          metadata?: Json;
          payload_type?: string | null;
          latency_ms?: number | null;
          telemetry_event_ids?: string[] | null;
          created_at?: string;
          soft_deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['copilot_messages']['Row']>;
        Relationships: [];
      };
      mission_metadata: {
        Row: {
          mission_id: string;
          tenant_id: string;
          field: string;
          value: Json;
          confidence: number | null;
          source: string;
          regeneration_count: number;
          accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          mission_id: string;
          tenant_id: string;
          field: string;
          value?: Json;
          confidence?: number | null;
          source?: string;
          regeneration_count?: number;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mission_metadata']['Row']>;
        Relationships: [];
      };
      mission_safeguards: {
        Row: {
          id: string;
          mission_id: string;
          tenant_id: string;
          hint_type: string;
          suggested_value: Json;
          confidence: number | null;
          status: string;
          source: string;
          generation_count: number;
          accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mission_id: string;
          tenant_id: string;
          hint_type: string;
          suggested_value?: Json;
          confidence?: number | null;
          status?: string;
          source?: string;
          generation_count?: number;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mission_safeguards']['Row']>;
        Relationships: [];
      };
      mission_events: {
        Row: {
          id: string;
          mission_id: string | null;
          tenant_id: string;
          event_name: string;
          event_payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          mission_id?: string | null;
          tenant_id: string;
          event_name: string;
          event_payload?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mission_events']['Row']>;
        Relationships: [];
      };
      planner_runs: {
        Row: {
          id: string;
          tenant_id: string;
          mission_id: string;
          latency_ms: number;
          candidate_count: number;
          embedding_similarity_avg: number | null;
          primary_toolkits: string[] | null;
          mode: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          mission_id: string;
          latency_ms: number;
          candidate_count: number;
          embedding_similarity_avg?: number | null;
          primary_toolkits?: string[] | null;
          mode?: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['planner_runs']['Row']>;
        Relationships: [];
      };
      safeguard_events: {
        Row: {
          id: string;
          mission_id: string | null;
          tenant_id: string;
          event_type: string;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          mission_id?: string | null;
          tenant_id: string;
          event_type: string;
          details?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['safeguard_events']['Row']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_library_entries: {
        Args: {
          query_embedding: unknown;
          match_count: number;
        };
        Returns: {
          id: string;
          similarity: number;
        }[];
      };
      cleanup_copilot_messages: {
        Args: {
          retention_days?: number;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
