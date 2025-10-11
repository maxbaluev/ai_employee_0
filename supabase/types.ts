export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      approvals: {
        Row: {
          decision: string;
          decision_at: string;
          guardrail_violation: Json | null;
          id: string;
          justification: string | null;
          metadata: Json;
          reviewer_id: string | null;
          tenant_id: string;
          tool_call_id: string;
        };
        Insert: {
          decision: string;
          decision_at?: string;
          guardrail_violation?: Json | null;
          id?: string;
          justification?: string | null;
          metadata?: Json;
          reviewer_id?: string | null;
          tenant_id: string;
          tool_call_id: string;
        };
        Update: {
          decision?: string;
          decision_at?: string;
          guardrail_violation?: Json | null;
          id?: string;
          justification?: string | null;
          metadata?: Json;
          reviewer_id?: string | null;
          tenant_id?: string;
          tool_call_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approvals_tool_call_id_fkey";
            columns: ["tool_call_id"];
            isOneToOne: true;
            referencedRelation: "tool_calls";
            referencedColumns: ["id"];
          },
        ];
      };
      artifacts: {
        Row: {
          checksum: string | null;
          content: Json | null;
          content_ref: string | null;
          created_at: string;
          hash: string | null;
          id: string;
          play_id: string | null;
          reviewer_edits: Json | null;
          size_bytes: number | null;
          status: string;
          tenant_id: string;
          title: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          checksum?: string | null;
          content?: Json | null;
          content_ref?: string | null;
          created_at?: string;
          hash?: string | null;
          id?: string;
          play_id?: string | null;
          reviewer_edits?: Json | null;
          size_bytes?: number | null;
          status?: string;
          tenant_id: string;
          title: string;
          type: string;
          updated_at?: string;
        };
        Update: {
          checksum?: string | null;
          content?: Json | null;
          content_ref?: string | null;
          created_at?: string;
          hash?: string | null;
          id?: string;
          play_id?: string | null;
          reviewer_edits?: Json | null;
          size_bytes?: number | null;
          status?: string;
          tenant_id?: string;
          title?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "artifacts_play_id_fkey";
            columns: ["play_id"];
            isOneToOne: false;
            referencedRelation: "plays";
            referencedColumns: ["id"];
          },
        ];
      };
      copilot_messages: {
        Row: {
          content: Json;
          created_at: string;
          id: string;
          latency_ms: number | null;
          metadata: Json;
          mission_id: string | null;
          payload_type: string | null;
          role: string;
          session_id: string;
          soft_deleted_at: string | null;
          telemetry_event_ids: string[] | null;
          tenant_id: string;
        };
        Insert: {
          content: Json;
          created_at?: string;
          id?: string;
          latency_ms?: number | null;
          metadata?: Json;
          mission_id?: string | null;
          payload_type?: string | null;
          role: string;
          session_id: string;
          soft_deleted_at?: string | null;
          telemetry_event_ids?: string[] | null;
          tenant_id: string;
        };
        Update: {
          content?: Json;
          created_at?: string;
          id?: string;
          latency_ms?: number | null;
          metadata?: Json;
          mission_id?: string | null;
          payload_type?: string | null;
          role?: string;
          session_id?: string;
          soft_deleted_at?: string | null;
          telemetry_event_ids?: string[] | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "copilot_messages_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "copilot_messages_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "copilot_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      copilot_sessions: {
        Row: {
          agent_id: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          session_identifier: string;
          state: Json;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          agent_id: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          session_identifier: string;
          state?: Json;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          agent_id?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          session_identifier?: string;
          state?: Json;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      guardrail_profiles: {
        Row: {
          budget_cap: Json;
          created_at: string;
          escalation_contacts: Json;
          id: string;
          label: string;
          quiet_hours: Json;
          rate_limit: Json;
          tenant_id: string;
          tone_policy: Json;
          undo_required: boolean;
          updated_at: string;
        };
        Insert: {
          budget_cap?: Json;
          created_at?: string;
          escalation_contacts?: Json;
          id?: string;
          label: string;
          quiet_hours?: Json;
          rate_limit?: Json;
          tenant_id: string;
          tone_policy?: Json;
          undo_required?: boolean;
          updated_at?: string;
        };
        Update: {
          budget_cap?: Json;
          created_at?: string;
          escalation_contacts?: Json;
          id?: string;
          label?: string;
          quiet_hours?: Json;
          rate_limit?: Json;
          tenant_id?: string;
          tone_policy?: Json;
          undo_required?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      inspection_findings: {
        Row: {
          created_at: string;
          finding_type: string | null;
          id: string;
          mission_id: string;
          payload: Json;
          readiness: number | null;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          finding_type?: string | null;
          id?: string;
          mission_id: string;
          payload?: Json;
          readiness?: number | null;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          finding_type?: string | null;
          id?: string;
          mission_id?: string;
          payload?: Json;
          readiness?: number | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_findings_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id"];
          },
        ];
      };
      library_entries: {
        Row: {
          created_at: string;
          description: string | null;
          embedding: string;
          id: string;
          metadata: Json;
          persona: string | null;
          reuse_count: number;
          success_score: number | null;
          tenant_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          embedding: string;
          id?: string;
          metadata?: Json;
          persona?: string | null;
          reuse_count?: number;
          success_score?: number | null;
          tenant_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          embedding?: string;
          id?: string;
          metadata?: Json;
          persona?: string | null;
          reuse_count?: number;
          success_score?: number | null;
          tenant_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      mission_events: {
        Row: {
          created_at: string;
          event_name: string;
          event_payload: Json;
          id: string;
          mission_id: string | null;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          event_name: string;
          event_payload?: Json;
          id?: string;
          mission_id?: string | null;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          event_name?: string;
          event_payload?: Json;
          id?: string;
          mission_id?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mission_events_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_feedback: {
        Row: {
          artifact_id: string | null;
          created_at: string;
          feedback_text: string | null;
          id: string;
          learning_signals: Json;
          mission_id: string;
          rating: number | null;
          reviewer_id: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          artifact_id?: string | null;
          created_at?: string;
          feedback_text?: string | null;
          id?: string;
          learning_signals?: Json;
          mission_id: string;
          rating?: number | null;
          reviewer_id?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          artifact_id?: string | null;
          created_at?: string;
          feedback_text?: string | null;
          id?: string;
          learning_signals?: Json;
          mission_id?: string;
          rating?: number | null;
          reviewer_id?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mission_feedback_artifact_id_fkey";
            columns: ["artifact_id"];
            isOneToOne: false;
            referencedRelation: "artifacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mission_feedback_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_guardrails: {
        Row: {
          custom_overrides: Json | null;
          effective_at: string;
          guardrail_profile_id: string;
          mission_id: string;
        };
        Insert: {
          custom_overrides?: Json | null;
          effective_at?: string;
          guardrail_profile_id: string;
          mission_id: string;
        };
        Update: {
          custom_overrides?: Json | null;
          effective_at?: string;
          guardrail_profile_id?: string;
          mission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mission_guardrails_guardrail_profile_id_fkey";
            columns: ["guardrail_profile_id"];
            isOneToOne: false;
            referencedRelation: "guardrail_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mission_guardrails_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_metadata: {
        Row: {
          accepted_at: string | null;
          confidence: number | null;
          created_at: string;
          field: string;
          mission_id: string;
          regeneration_count: number;
          source: string;
          tenant_id: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          accepted_at?: string | null;
          confidence?: number | null;
          created_at?: string;
          field: string;
          mission_id: string;
          regeneration_count?: number;
          source?: string;
          tenant_id: string;
          updated_at?: string;
          value?: Json;
        };
        Update: {
          accepted_at?: string | null;
          confidence?: number | null;
          created_at?: string;
          field?: string;
          mission_id?: string;
          regeneration_count?: number;
          source?: string;
          tenant_id?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "mission_metadata_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_safeguards: {
        Row: {
          accepted_at: string | null;
          confidence: number | null;
          created_at: string;
          generation_count: number;
          hint_type: string;
          id: string;
          mission_id: string;
          source: string;
          status: string;
          suggested_value: Json;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          confidence?: number | null;
          created_at?: string;
          generation_count?: number;
          hint_type: string;
          id?: string;
          mission_id: string;
          source?: string;
          status?: string;
          suggested_value?: Json;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          confidence?: number | null;
          created_at?: string;
          generation_count?: number;
          hint_type?: string;
          id?: string;
          mission_id?: string;
          source?: string;
          status?: string;
          suggested_value?: Json;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mission_safeguards_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id"];
          },
        ];
      };
      oauth_tokens: {
        Row: {
          access_token_ciphertext: string;
          connection_id: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          metadata: Json;
          provider: string;
          refresh_token_ciphertext: string | null;
          scope: string[];
          tenant_id: string;
          token_fingerprint: string;
          updated_at: string;
        };
        Insert: {
          access_token_ciphertext: string;
          connection_id: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          metadata?: Json;
          provider: string;
          refresh_token_ciphertext?: string | null;
          scope?: string[];
          tenant_id: string;
          token_fingerprint: string;
          updated_at?: string;
        };
        Update: {
          access_token_ciphertext?: string;
          connection_id?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          metadata?: Json;
          provider?: string;
          refresh_token_ciphertext?: string | null;
          scope?: string[];
          tenant_id?: string;
          token_fingerprint?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      objectives: {
        Row: {
          audience: string;
          created_at: string;
          created_by: string | null;
          goal: string;
          guardrails: Json;
          id: string;
          metadata: Json;
          status: string;
          tenant_id: string;
          timeframe: string | null;
          updated_at: string;
        };
        Insert: {
          audience: string;
          created_at?: string;
          created_by?: string | null;
          goal: string;
          guardrails?: Json;
          id?: string;
          metadata?: Json;
          status?: string;
          tenant_id: string;
          timeframe?: string | null;
          updated_at?: string;
        };
        Update: {
          audience?: string;
          created_at?: string;
          created_by?: string | null;
          goal?: string;
          guardrails?: Json;
          id?: string;
          metadata?: Json;
          status?: string;
          tenant_id?: string;
          timeframe?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      planner_runs: {
        Row: {
          candidate_count: number;
          created_at: string;
          embedding_similarity_avg: number | null;
          id: string;
          latency_ms: number;
          metadata: Json | null;
          mission_id: string;
          mode: string;
          primary_toolkits: string[] | null;
          tenant_id: string;
        };
        Insert: {
          candidate_count: number;
          created_at?: string;
          embedding_similarity_avg?: number | null;
          id?: string;
          latency_ms: number;
          metadata?: Json | null;
          mission_id: string;
          mode?: string;
          primary_toolkits?: string[] | null;
          tenant_id: string;
        };
        Update: {
          candidate_count?: number;
          created_at?: string;
          embedding_similarity_avg?: number | null;
          id?: string;
          latency_ms?: number;
          metadata?: Json | null;
          mission_id?: string;
          mode?: string;
          primary_toolkits?: string[] | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planner_runs_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id"];
          },
        ];
      };
      plays: {
        Row: {
          confidence: number | null;
          created_at: string;
          evidence_hash: string | null;
          id: string;
          impact_estimate: string | null;
          latency_ms: number | null;
          mode: string;
          objective_id: string;
          plan_json: Json;
          risk_profile: string | null;
          success_score: number | null;
          telemetry: Json;
          tenant_id: string;
          tool_count: number | null;
          undo_plan: string | null;
          updated_at: string;
        };
        Insert: {
          confidence?: number | null;
          created_at?: string;
          evidence_hash?: string | null;
          id?: string;
          impact_estimate?: string | null;
          latency_ms?: number | null;
          mode?: string;
          objective_id: string;
          plan_json?: Json;
          risk_profile?: string | null;
          success_score?: number | null;
          telemetry?: Json;
          tenant_id: string;
          tool_count?: number | null;
          undo_plan?: string | null;
          updated_at?: string;
        };
        Update: {
          confidence?: number | null;
          created_at?: string;
          evidence_hash?: string | null;
          id?: string;
          impact_estimate?: string | null;
          latency_ms?: number | null;
          mode?: string;
          objective_id?: string;
          plan_json?: Json;
          risk_profile?: string | null;
          success_score?: number | null;
          telemetry?: Json;
          tenant_id?: string;
          tool_count?: number | null;
          undo_plan?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plays_objective_id_fkey";
            columns: ["objective_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id"];
          },
        ];
      };
      safeguard_events: {
        Row: {
          created_at: string;
          details: Json;
          event_type: string;
          id: string;
          mission_id: string | null;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          details?: Json;
          event_type: string;
          id?: string;
          mission_id?: string | null;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          details?: Json;
          event_type?: string;
          id?: string;
          mission_id?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "safeguard_events_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id"];
          },
        ];
      };
      tool_calls: {
        Row: {
          arguments: Json;
          arguments_hash: string;
          executed_at: string;
          guardrail_snapshot: Json | null;
          id: string;
          latency_ms: number | null;
          outcome: Json | null;
          play_id: string;
          quiet_hour_override: boolean;
          result_ref: string | null;
          tenant_id: string;
          tool_name: string;
          toolkit: string;
          undo_plan: string | null;
          undo_plan_json: Json | null;
        };
        Insert: {
          arguments?: Json;
          arguments_hash: string;
          executed_at?: string;
          guardrail_snapshot?: Json | null;
          id?: string;
          latency_ms?: number | null;
          outcome?: Json | null;
          play_id: string;
          quiet_hour_override?: boolean;
          result_ref?: string | null;
          tenant_id: string;
          tool_name: string;
          toolkit: string;
          undo_plan?: string | null;
          undo_plan_json?: Json | null;
        };
        Update: {
          arguments?: Json;
          arguments_hash?: string;
          executed_at?: string;
          guardrail_snapshot?: Json | null;
          id?: string;
          latency_ms?: number | null;
          outcome?: Json | null;
          play_id?: string;
          quiet_hour_override?: boolean;
          result_ref?: string | null;
          tenant_id?: string;
          tool_name?: string;
          toolkit?: string;
          undo_plan?: string | null;
          undo_plan_json?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "tool_calls_play_id_fkey";
            columns: ["play_id"];
            isOneToOne: false;
            referencedRelation: "plays";
            referencedColumns: ["id"];
          },
        ];
      };
      toolkit_selections: {
        Row: {
          created_at: string;
          id: string;
          mission_id: string;
          rationale: string | null;
          selected_tools: Json;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          mission_id: string;
          rationale?: string | null;
          selected_tools?: Json;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          mission_id?: string;
          rationale?: string | null;
          selected_tools?: Json;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "toolkit_selections_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      analytics_connection_adoption: {
        Row: {
          accepted_count: number | null;
          adoption_rate: number | null;
          avg_confidence: number | null;
          edited_count: number | null;
          hint_type: string | null;
          rejected_count: number | null;
          tenant_id: string | null;
          total_hints: number | null;
        };
        Relationships: [];
      };
      analytics_generative_acceptance: {
        Row: {
          acceptance_rate: number | null;
          accepted_count: number | null;
          avg_confidence: number | null;
          avg_regenerations: number | null;
          edited_count: number | null;
          field: string | null;
          tenant_id: string | null;
          total_generated: number | null;
        };
        Relationships: [];
      };
      analytics_planner_performance: {
        Row: {
          avg_candidates: number | null;
          avg_latency_ms: number | null;
          avg_similarity: number | null;
          mode: string | null;
          p95_latency_ms: number | null;
          tenant_id: string | null;
          total_runs: number | null;
        };
        Relationships: [];
      };
      analytics_undo_success: {
        Row: {
          tenant_id: string | null;
          toolkit: string | null;
          total_tool_calls: number | null;
          undo_coverage_rate: number | null;
          undo_plan_present: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown };
        Returns: unknown;
      };
      cleanup_copilot_messages: {
        Args: { retention_days?: number };
        Returns: number;
      };
      halfvec_avg: {
        Args: { "": number[] };
        Returns: unknown;
      };
      halfvec_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      halfvec_send: {
        Args: { "": unknown };
        Returns: string;
      };
      halfvec_typmod_in: {
        Args: { "": unknown[] };
        Returns: number;
      };
      hnsw_bit_support: {
        Args: { "": unknown };
        Returns: unknown;
      };
      hnsw_halfvec_support: {
        Args: { "": unknown };
        Returns: unknown;
      };
      hnsw_sparsevec_support: {
        Args: { "": unknown };
        Returns: unknown;
      };
      hnswhandler: {
        Args: { "": unknown };
        Returns: unknown;
      };
      ivfflat_bit_support: {
        Args: { "": unknown };
        Returns: unknown;
      };
      ivfflat_halfvec_support: {
        Args: { "": unknown };
        Returns: unknown;
      };
      ivfflathandler: {
        Args: { "": unknown };
        Returns: unknown;
      };
      l2_norm: {
        Args: { "": unknown } | { "": unknown };
        Returns: number;
      };
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown };
        Returns: string;
      };
      match_library_entries: {
        Args: { match_count: number; query_embedding: string };
        Returns: {
          id: string;
          similarity: number;
        }[];
      };
      sparsevec_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      sparsevec_send: {
        Args: { "": unknown };
        Returns: string;
      };
      sparsevec_typmod_in: {
        Args: { "": unknown[] };
        Returns: number;
      };
      vector_avg: {
        Args: { "": number[] };
        Returns: string;
      };
      vector_dims: {
        Args: { "": string } | { "": unknown };
        Returns: number;
      };
      vector_norm: {
        Args: { "": string };
        Returns: number;
      };
      vector_out: {
        Args: { "": string };
        Returns: unknown;
      };
      vector_send: {
        Args: { "": string };
        Returns: string;
      };
      vector_typmod_in: {
        Args: { "": unknown[] };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null;
          avif_autodetection: boolean | null;
          created_at: string | null;
          file_size_limit: number | null;
          id: string;
          name: string;
          owner: string | null;
          owner_id: string | null;
          public: boolean | null;
          type: Database["storage"]["Enums"]["buckettype"];
          updated_at: string | null;
        };
        Insert: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id: string;
          name: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string | null;
        };
        Update: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id?: string;
          name?: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string | null;
        };
        Relationships: [];
      };
      buckets_analytics: {
        Row: {
          created_at: string;
          format: string;
          id: string;
          type: Database["storage"]["Enums"]["buckettype"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          format?: string;
          id: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          format?: string;
          id?: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Relationships: [];
      };
      migrations: {
        Row: {
          executed_at: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Insert: {
          executed_at?: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Update: {
          executed_at?: string | null;
          hash?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      objects: {
        Row: {
          bucket_id: string | null;
          created_at: string | null;
          id: string;
          last_accessed_at: string | null;
          level: number | null;
          metadata: Json | null;
          name: string | null;
          owner: string | null;
          owner_id: string | null;
          path_tokens: string[] | null;
          updated_at: string | null;
          user_metadata: Json | null;
          version: string | null;
        };
        Insert: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          level?: number | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Update: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          level?: number | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
        ];
      };
      prefixes: {
        Row: {
          bucket_id: string;
          created_at: string | null;
          level: number;
          name: string;
          updated_at: string | null;
        };
        Insert: {
          bucket_id: string;
          created_at?: string | null;
          level?: number;
          name: string;
          updated_at?: string | null;
        };
        Update: {
          bucket_id?: string;
          created_at?: string | null;
          level?: number;
          name?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "prefixes_bucketId_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
        ];
      };
      s3_multipart_uploads: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          in_progress_size: number;
          key: string;
          owner_id: string | null;
          upload_signature: string;
          user_metadata: Json | null;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id: string;
          in_progress_size?: number;
          key: string;
          owner_id?: string | null;
          upload_signature: string;
          user_metadata?: Json | null;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          in_progress_size?: number;
          key?: string;
          owner_id?: string | null;
          upload_signature?: string;
          user_metadata?: Json | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
        ];
      };
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string;
          created_at: string;
          etag: string;
          id: string;
          key: string;
          owner_id: string | null;
          part_number: number;
          size: number;
          upload_id: string;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          etag: string;
          id?: string;
          key: string;
          owner_id?: string | null;
          part_number: number;
          size?: number;
          upload_id: string;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          etag?: string;
          id?: string;
          key?: string;
          owner_id?: string | null;
          part_number?: number;
          size?: number;
          upload_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey";
            columns: ["upload_id"];
            isOneToOne: false;
            referencedRelation: "s3_multipart_uploads";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_prefixes: {
        Args: { _bucket_id: string; _name: string };
        Returns: undefined;
      };
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string };
        Returns: undefined;
      };
      delete_leaf_prefixes: {
        Args: { bucket_ids: string[]; names: string[] };
        Returns: undefined;
      };
      delete_prefix: {
        Args: { _bucket_id: string; _name: string };
        Returns: boolean;
      };
      extension: {
        Args: { name: string };
        Returns: string;
      };
      filename: {
        Args: { name: string };
        Returns: string;
      };
      foldername: {
        Args: { name: string };
        Returns: string[];
      };
      get_level: {
        Args: { name: string };
        Returns: number;
      };
      get_prefix: {
        Args: { name: string };
        Returns: string;
      };
      get_prefixes: {
        Args: { name: string };
        Returns: string[];
      };
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>;
        Returns: {
          bucket_id: string;
          size: number;
        }[];
      };
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_key_token?: string;
          next_upload_token?: string;
          prefix_param: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
        }[];
      };
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_token?: string;
          prefix_param: string;
          start_after?: string;
        };
        Returns: {
          id: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      lock_top_prefixes: {
        Args: { bucket_ids: string[]; names: string[] };
        Returns: undefined;
      };
      operation: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      search: {
        Args: {
          bucketname: string;
          levels?: number;
          limits?: number;
          offsets?: number;
          prefix: string;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_legacy_v1: {
        Args: {
          bucketname: string;
          levels?: number;
          limits?: number;
          offsets?: number;
          prefix: string;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_v1_optimised: {
        Args: {
          bucketname: string;
          levels?: number;
          limits?: number;
          offsets?: number;
          prefix: string;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_v2: {
        Args: {
          bucket_name: string;
          levels?: number;
          limits?: number;
          prefix: string;
          sort_column?: string;
          sort_column_after?: string;
          sort_order?: string;
          start_after?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
    };
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS"],
    },
  },
} as const;
