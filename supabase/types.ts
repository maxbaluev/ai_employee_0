export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      composio_audit_events: {
        Row: {
          action: string | null
          error_code: string | null
          id: string
          latency_ms: number | null
          mission_id: string | null
          occurred_at: string
          outcome: Json
          retries: number
          status: string | null
          tenant_id: string | null
          toolkit: string | null
        }
        Insert: {
          action?: string | null
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          mission_id?: string | null
          occurred_at?: string
          outcome?: Json
          retries?: number
          status?: string | null
          tenant_id?: string | null
          toolkit?: string | null
        }
        Update: {
          action?: string | null
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          mission_id?: string | null
          occurred_at?: string
          outcome?: Json
          retries?: number
          status?: string | null
          tenant_id?: string | null
          toolkit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "composio_audit_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "composio_audit_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "composio_audit_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composio_audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      data_inspection_checks: {
        Row: {
          coverage_percent: number | null
          created_at: string
          details: Json
          id: string
          inspector_id: string | null
          mission_id: string
          outcome: Database["public"]["Enums"]["inspection_outcome"]
          pii_flags: Json | null
          sample_count: number | null
          toolkit_slug: string | null
        }
        Insert: {
          coverage_percent?: number | null
          created_at?: string
          details?: Json
          id?: string
          inspector_id?: string | null
          mission_id: string
          outcome?: Database["public"]["Enums"]["inspection_outcome"]
          pii_flags?: Json | null
          sample_count?: number | null
          toolkit_slug?: string | null
        }
        Update: {
          coverage_percent?: number | null
          created_at?: string
          details?: Json
          id?: string
          inspector_id?: string | null
          mission_id?: string
          outcome?: Database["public"]["Enums"]["inspection_outcome"]
          pii_flags?: Json | null
          sample_count?: number | null
          toolkit_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_inspection_checks_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "data_inspection_checks_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "data_inspection_checks_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      library_embeddings: {
        Row: {
          embedding: string
          embedding_model: string | null
          embedding_provider: string | null
          entry_id: string
          updated_at: string
        }
        Insert: {
          embedding: string
          embedding_model?: string | null
          embedding_provider?: string | null
          entry_id: string
          updated_at?: string
        }
        Update: {
          embedding?: string
          embedding_model?: string | null
          embedding_provider?: string | null
          entry_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_embeddings_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "library_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      library_entries: {
        Row: {
          average_rating: number | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          persona: string | null
          playbook: Json
          reuse_count: number
          source_artifact_id: string | null
          source_mission_id: string | null
          tags: string[] | null
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          average_rating?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          persona?: string | null
          playbook?: Json
          reuse_count?: number
          source_artifact_id?: string | null
          source_mission_id?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          average_rating?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          persona?: string | null
          playbook?: Json
          reuse_count?: number
          source_artifact_id?: string | null
          source_mission_id?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_entries_source_artifact_id_fkey"
            columns: ["source_artifact_id"]
            isOneToOne: false
            referencedRelation: "mission_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_entries_source_mission_id_fkey"
            columns: ["source_mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "library_entries_source_mission_id_fkey"
            columns: ["source_mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "library_entries_source_mission_id_fkey"
            columns: ["source_mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_approvals: {
        Row: {
          approver_id: string | null
          approver_role: string
          created_at: string
          decision_at: string | null
          due_at: string | null
          id: string
          metadata: Json
          mission_id: string
          mission_play_id: string | null
          rationale: string | null
          status: Database["public"]["Enums"]["approval_status"]
          undo_plan_id: string | null
          updated_at: string
        }
        Insert: {
          approver_id?: string | null
          approver_role: string
          created_at?: string
          decision_at?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          mission_id: string
          mission_play_id?: string | null
          rationale?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          undo_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          approver_id?: string | null
          approver_role?: string
          created_at?: string
          decision_at?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          mission_id?: string
          mission_play_id?: string | null
          rationale?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          undo_plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_approvals_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_approvals_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_approvals_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_approvals_mission_play_id_fkey"
            columns: ["mission_play_id"]
            isOneToOne: false
            referencedRelation: "mission_plays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_approvals_undo_plan_id_fkey"
            columns: ["undo_plan_id"]
            isOneToOne: false
            referencedRelation: "mission_undo_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_artifacts: {
        Row: {
          artifact_type: string
          created_at: string
          created_by: string | null
          description: string | null
          hash: string | null
          id: string
          metadata: Json
          mission_id: string
          name: string | null
          source_stage: Database["public"]["Enums"]["mission_stage"] | null
          storage_path: string | null
          storage_provider: string | null
          updated_at: string
        }
        Insert: {
          artifact_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          hash?: string | null
          id?: string
          metadata?: Json
          mission_id: string
          name?: string | null
          source_stage?: Database["public"]["Enums"]["mission_stage"] | null
          storage_path?: string | null
          storage_provider?: string | null
          updated_at?: string
        }
        Update: {
          artifact_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          hash?: string | null
          id?: string
          metadata?: Json
          mission_id?: string
          name?: string | null
          source_stage?: Database["public"]["Enums"]["mission_stage"] | null
          storage_path?: string | null
          storage_provider?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_artifacts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_artifacts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_artifacts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_connections: {
        Row: {
          approved_at: string | null
          connect_link_id: string | null
          expires_at: string | null
          granted_scopes: Json
          id: string
          metadata: Json
          mission_id: string
          requested_at: string
          requested_scopes: Json
          status: Database["public"]["Enums"]["connection_status"]
          toolkit_slug: string
        }
        Insert: {
          approved_at?: string | null
          connect_link_id?: string | null
          expires_at?: string | null
          granted_scopes?: Json
          id?: string
          metadata?: Json
          mission_id: string
          requested_at?: string
          requested_scopes?: Json
          status?: Database["public"]["Enums"]["connection_status"]
          toolkit_slug: string
        }
        Update: {
          approved_at?: string | null
          connect_link_id?: string | null
          expires_at?: string | null
          granted_scopes?: Json
          id?: string
          metadata?: Json
          mission_id?: string
          requested_at?: string
          requested_scopes?: Json
          status?: Database["public"]["Enums"]["connection_status"]
          toolkit_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_connections_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_connections_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_connections_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_evidence: {
        Row: {
          artifact_id: string | null
          created_at: string
          display_message: string | null
          id: string
          metadata: Json
          mission_id: string
          redaction_status: Database["public"]["Enums"]["redaction_state"]
          source_stage: Database["public"]["Enums"]["mission_stage"] | null
        }
        Insert: {
          artifact_id?: string | null
          created_at?: string
          display_message?: string | null
          id?: string
          metadata?: Json
          mission_id: string
          redaction_status?: Database["public"]["Enums"]["redaction_state"]
          source_stage?: Database["public"]["Enums"]["mission_stage"] | null
        }
        Update: {
          artifact_id?: string | null
          created_at?: string
          display_message?: string | null
          id?: string
          metadata?: Json
          mission_id?: string
          redaction_status?: Database["public"]["Enums"]["redaction_state"]
          source_stage?: Database["public"]["Enums"]["mission_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_evidence_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "mission_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_evidence_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_evidence_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_evidence_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_feedback: {
        Row: {
          blockers: string | null
          effort_saved_hours: number | null
          id: string
          metadata: Json
          mission_id: string
          persona: string | null
          qualitative_notes: string | null
          rating: number | null
          submitted_at: string
          user_id: string | null
        }
        Insert: {
          blockers?: string | null
          effort_saved_hours?: number | null
          id?: string
          metadata?: Json
          mission_id: string
          persona?: string | null
          qualitative_notes?: string | null
          rating?: number | null
          submitted_at?: string
          user_id?: string | null
        }
        Update: {
          blockers?: string | null
          effort_saved_hours?: number | null
          id?: string
          metadata?: Json
          mission_id?: string
          persona?: string | null
          qualitative_notes?: string | null
          rating?: number | null
          submitted_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_feedback_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_feedback_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_feedback_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_followups: {
        Row: {
          bd_issue: string | null
          completed_at: string | null
          created_at: string
          due_at: string | null
          id: string
          metadata: Json
          mission_id: string
          owner_id: string | null
          owner_role: string | null
          status: Database["public"]["Enums"]["followup_state"]
          task_type: string
        }
        Insert: {
          bd_issue?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          metadata?: Json
          mission_id: string
          owner_id?: string | null
          owner_role?: string | null
          status?: Database["public"]["Enums"]["followup_state"]
          task_type: string
        }
        Update: {
          bd_issue?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          metadata?: Json
          mission_id?: string
          owner_id?: string | null
          owner_role?: string | null
          status?: Database["public"]["Enums"]["followup_state"]
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_followups_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_followups_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_followups_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_metadata: {
        Row: {
          created_at: string
          id: string
          metadata_key: string
          metadata_value: Json
          mission_id: string
          source_stage: Database["public"]["Enums"]["mission_stage"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata_key: string
          metadata_value?: Json
          mission_id: string
          source_stage?: Database["public"]["Enums"]["mission_stage"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata_key?: string
          metadata_value?: Json
          mission_id?: string
          source_stage?: Database["public"]["Enums"]["mission_stage"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_metadata_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_metadata_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_metadata_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_plays: {
        Row: {
          confidence: number | null
          created_at: string
          description: string | null
          generated_by: string | null
          id: string
          metadata: Json
          mission_id: string
          play_identifier: string | null
          ranking: number | null
          selected: boolean
          title: string
          undo_plan_id: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          description?: string | null
          generated_by?: string | null
          id?: string
          metadata?: Json
          mission_id: string
          play_identifier?: string | null
          ranking?: number | null
          selected?: boolean
          title: string
          undo_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          description?: string | null
          generated_by?: string | null
          id?: string
          metadata?: Json
          mission_id?: string
          play_identifier?: string | null
          ranking?: number | null
          selected?: boolean
          title?: string
          undo_plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_plays_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_plays_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_plays_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_plays_undo_plan_id_fkey"
            columns: ["undo_plan_id"]
            isOneToOne: false
            referencedRelation: "mission_undo_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_retrospectives: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          impact_metrics: Json
          mission_id: string
          next_actions: Json
          safeguard_compliance: Json
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          impact_metrics?: Json
          mission_id: string
          next_actions?: Json
          safeguard_compliance?: Json
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          impact_metrics?: Json
          mission_id?: string
          next_actions?: Json
          safeguard_compliance?: Json
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_retrospectives_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_retrospectives_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_retrospectives_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_safeguards: {
        Row: {
          added_by: string | null
          added_role: string | null
          category: string
          created_at: string
          description: string | null
          enforced: boolean
          id: string
          metadata: Json
          mission_id: string
          resolution_note: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["safeguard_severity"]
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          added_role?: string | null
          category: string
          created_at?: string
          description?: string | null
          enforced?: boolean
          id?: string
          metadata?: Json
          mission_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["safeguard_severity"]
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          added_role?: string | null
          category?: string
          created_at?: string
          description?: string | null
          enforced?: boolean
          id?: string
          metadata?: Json
          mission_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["safeguard_severity"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_safeguards_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_safeguards_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_safeguards_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_sessions: {
        Row: {
          agent_name: string
          created_at: string
          id: string
          lag_ms: number | null
          last_heartbeat_at: string
          mission_id: string
          session_key: string | null
          state: Json
          state_size_bytes: number | null
          status: Database["public"]["Enums"]["session_state"]
          token_usage: number | null
          updated_at: string
        }
        Insert: {
          agent_name: string
          created_at?: string
          id?: string
          lag_ms?: number | null
          last_heartbeat_at?: string
          mission_id: string
          session_key?: string | null
          state?: Json
          state_size_bytes?: number | null
          status?: Database["public"]["Enums"]["session_state"]
          token_usage?: number | null
          updated_at?: string
        }
        Update: {
          agent_name?: string
          created_at?: string
          id?: string
          lag_ms?: number | null
          last_heartbeat_at?: string
          mission_id?: string
          session_key?: string | null
          state?: Json
          state_size_bytes?: number | null
          status?: Database["public"]["Enums"]["session_state"]
          token_usage?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_stage_status: {
        Row: {
          blocking_reason: string | null
          completed_at: string | null
          coverage_percent: number | null
          id: string
          metrics: Json
          mission_id: string
          readiness_state: Database["public"]["Enums"]["readiness_state"]
          stage: Database["public"]["Enums"]["mission_stage"]
          started_at: string | null
          status: Database["public"]["Enums"]["stage_progress_state"]
          updated_at: string
        }
        Insert: {
          blocking_reason?: string | null
          completed_at?: string | null
          coverage_percent?: number | null
          id?: string
          metrics?: Json
          mission_id: string
          readiness_state?: Database["public"]["Enums"]["readiness_state"]
          stage: Database["public"]["Enums"]["mission_stage"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["stage_progress_state"]
          updated_at?: string
        }
        Update: {
          blocking_reason?: string | null
          completed_at?: string | null
          coverage_percent?: number | null
          id?: string
          metrics?: Json
          mission_id?: string
          readiness_state?: Database["public"]["Enums"]["readiness_state"]
          stage?: Database["public"]["Enums"]["mission_stage"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["stage_progress_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_stage_status_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_stage_status_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_stage_status_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_undo_plans: {
        Row: {
          created_at: string
          id: string
          impact_summary: string | null
          mission_id: string
          plan_label: string
          risk_assessment: string | null
          status: Database["public"]["Enums"]["undo_plan_state"]
          steps: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          impact_summary?: string | null
          mission_id: string
          plan_label: string
          risk_assessment?: string | null
          status?: Database["public"]["Enums"]["undo_plan_state"]
          steps?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          impact_summary?: string | null
          mission_id?: string
          plan_label?: string
          risk_assessment?: string | null
          status?: Database["public"]["Enums"]["undo_plan_state"]
          steps?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_undo_plans_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_undo_plans_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_undo_plans_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          archived_at: string | null
          brief_locked_at: string | null
          completed_at: string | null
          created_at: string
          current_stage: Database["public"]["Enums"]["mission_stage"]
          description: string | null
          external_ref: string | null
          id: string
          intent: Json
          owner_id: string | null
          owner_role: string | null
          persona_id: string | null
          priority: string | null
          readiness: Database["public"]["Enums"]["readiness_state"]
          ready_at: string | null
          status: Database["public"]["Enums"]["mission_status"]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          brief_locked_at?: string | null
          completed_at?: string | null
          created_at?: string
          current_stage?: Database["public"]["Enums"]["mission_stage"]
          description?: string | null
          external_ref?: string | null
          id?: string
          intent?: Json
          owner_id?: string | null
          owner_role?: string | null
          persona_id?: string | null
          priority?: string | null
          readiness?: Database["public"]["Enums"]["readiness_state"]
          ready_at?: string | null
          status?: Database["public"]["Enums"]["mission_status"]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          brief_locked_at?: string | null
          completed_at?: string | null
          created_at?: string
          current_stage?: Database["public"]["Enums"]["mission_stage"]
          description?: string | null
          external_ref?: string | null
          id?: string
          intent?: Json
          owner_id?: string | null
          owner_role?: string | null
          persona_id?: string | null
          priority?: string | null
          readiness?: Database["public"]["Enums"]["readiness_state"]
          ready_at?: string | null
          status?: Database["public"]["Enums"]["mission_status"]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      telemetry_events: {
        Row: {
          agent_name: string | null
          context: Json
          correlation_id: string | null
          created_at: string
          event_type: string
          id: string
          mission_id: string | null
          payload_sha: string | null
          stage: Database["public"]["Enums"]["mission_stage"] | null
          status: Database["public"]["Enums"]["telemetry_level"]
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          agent_name?: string | null
          context?: Json
          correlation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          mission_id?: string | null
          payload_sha?: string | null
          stage?: Database["public"]["Enums"]["mission_stage"] | null
          status?: Database["public"]["Enums"]["telemetry_level"]
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          agent_name?: string | null
          context?: Json
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          mission_id?: string | null
          payload_sha?: string | null
          stage?: Database["public"]["Enums"]["mission_stage"] | null
          status?: Database["public"]["Enums"]["telemetry_level"]
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "telemetry_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "telemetry_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telemetry_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      toolkit_selections: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          mission_id: string
          rank: number | null
          recommended: boolean
          selection_reason: string | null
          stage: Database["public"]["Enums"]["mission_stage"]
          toolkit_name: string | null
          toolkit_slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          mission_id: string
          rank?: number | null
          recommended?: boolean
          selection_reason?: string | null
          stage?: Database["public"]["Enums"]["mission_stage"]
          toolkit_name?: string | null
          toolkit_slug: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          mission_id?: string
          rank?: number | null
          recommended?: boolean
          selection_reason?: string | null
          stage?: Database["public"]["Enums"]["mission_stage"]
          toolkit_name?: string | null
          toolkit_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "toolkit_selections_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "toolkit_selections_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "toolkit_selections_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      undo_events: {
        Row: {
          event_type: Database["public"]["Enums"]["undo_event_type"]
          id: string
          initiated_by: string | null
          metadata: Json
          mission_id: string | null
          notes: string | null
          occurred_at: string
          status: Database["public"]["Enums"]["undo_status"]
          undo_plan_id: string | null
        }
        Insert: {
          event_type: Database["public"]["Enums"]["undo_event_type"]
          id?: string
          initiated_by?: string | null
          metadata?: Json
          mission_id?: string | null
          notes?: string | null
          occurred_at?: string
          status?: Database["public"]["Enums"]["undo_status"]
          undo_plan_id?: string | null
        }
        Update: {
          event_type?: Database["public"]["Enums"]["undo_event_type"]
          id?: string
          initiated_by?: string | null
          metadata?: Json
          mission_id?: string | null
          notes?: string | null
          occurred_at?: string
          status?: Database["public"]["Enums"]["undo_status"]
          undo_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "undo_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "undo_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "undo_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "undo_events_undo_plan_id_fkey"
            columns: ["undo_plan_id"]
            isOneToOne: false
            referencedRelation: "mission_undo_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_stream_sessions: {
        Row: {
          connected_at: string
          disconnected_at: string | null
          id: string
          metadata: Json
          mission_id: string | null
          sampling_mode: string | null
          session_id: string
          stage: Database["public"]["Enums"]["mission_stage"] | null
          telemetry_disabled: boolean
          tenant_id: string | null
        }
        Insert: {
          connected_at?: string
          disconnected_at?: string | null
          id?: string
          metadata?: Json
          mission_id?: string | null
          sampling_mode?: string | null
          session_id: string
          stage?: Database["public"]["Enums"]["mission_stage"] | null
          telemetry_disabled?: boolean
          tenant_id?: string | null
        }
        Update: {
          connected_at?: string
          disconnected_at?: string | null
          id?: string
          metadata?: Json
          mission_id?: string | null
          sampling_mode?: string | null
          session_id?: string
          stage?: Database["public"]["Enums"]["mission_stage"] | null
          telemetry_disabled?: boolean
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_stream_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "workspace_stream_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "workspace_stream_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_stream_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      adoption_funnel: {
        Row: {
          approvals_completed: number | null
          briefs_locked: number | null
          missions_completed: number | null
          missions_created: number | null
          readiness_achieved: number | null
          tenant_id: string | null
          week: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      adoption_funnel_mv: {
        Row: {
          approvals_completed: number | null
          briefs_locked: number | null
          missions_completed: number | null
          missions_created: number | null
          readiness_achieved: number | null
          tenant_id: string | null
          week: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_performance: {
        Row: {
          active_sessions: number | null
          agent_name: string | null
          avg_lag_ms: number | null
          avg_state_size: number | null
          avg_token_usage: number | null
          mission_id: string | null
          tenant_id: string | null
          terminated_sessions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_performance_mv: {
        Row: {
          active_sessions: number | null
          agent_name: string | null
          avg_lag_ms: number | null
          avg_state_size: number | null
          avg_token_usage: number | null
          mission_id: string | null
          tenant_id: string | null
          terminated_sessions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_readiness"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_stage_progress"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_summary: {
        Row: {
          active_missions: number | null
          avg_time_to_complete_hours: number | null
          completed_missions: number | null
          persona_count: number | null
          tenant_id: string | null
          week: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_summary_mv: {
        Row: {
          active_missions: number | null
          avg_time_to_complete_hours: number | null
          completed_missions: number | null
          persona_count: number | null
          tenant_id: string | null
          week: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_insights: {
        Row: {
          approvals_granted: number | null
          approvals_rejected: number | null
          blocked_stages: number | null
          day: string | null
          evidence_items: number | null
          ready_stages: number | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_insights_mv: {
        Row: {
          approvals_granted: number | null
          approvals_rejected: number | null
          blocked_stages: number | null
          day: string | null
          evidence_items: number | null
          ready_stages: number | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_readiness: {
        Row: {
          blocking_reason: string | null
          coverage_percent: number | null
          current_stage: Database["public"]["Enums"]["mission_stage"] | null
          mission_id: string | null
          readiness_state: Database["public"]["Enums"]["readiness_state"] | null
          readiness_updated_at: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_stage_progress: {
        Row: {
          coverage_percent: number | null
          mission_id: string | null
          readiness_state: Database["public"]["Enums"]["readiness_state"] | null
          stage: Database["public"]["Enums"]["mission_stage"] | null
          status: Database["public"]["Enums"]["stage_progress_state"] | null
          tenant_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operations_health: {
        Row: {
          active_streams: number | null
          avg_heartbeat_lag_ms: number | null
          error_events: number | null
          heartbeat_events: number | null
          hour: string | null
          tenant_id: string | null
          tool_failures: number | null
        }
        Relationships: []
      }
      operations_health_mv: {
        Row: {
          active_streams: number | null
          avg_heartbeat_lag_ms: number | null
          error_events: number | null
          heartbeat_events: number | null
          hour: string | null
          tenant_id: string | null
          tool_failures: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      cleanup_mission_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_telemetry_events: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      current_claims: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      current_roles: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      current_tenant_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_mission_readiness: {
        Args: { mid: string }
        Returns: Database["public"]["Enums"]["readiness_state"]
      }
      get_mission_stage_durations: {
        Args: { mid: string }
        Returns: {
          duration_seconds: number
          stage: Database["public"]["Enums"]["mission_stage"]
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      has_role: {
        Args: { target_role: string }
        Returns: boolean
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      mission_accessible: {
        Args: { mid: string }
        Returns: boolean
      }
      refresh_analytics_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_library_embeddings: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      search_library_entries: {
        Args: {
          limit_results?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          entry_id: string
          score: number
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      approval_status:
        | "requested"
        | "delegated"
        | "approved"
        | "rejected"
        | "expired"
      connection_status:
        | "initiated"
        | "approved"
        | "expired"
        | "revoked"
        | "failed"
      followup_state: "open" | "in_progress" | "done" | "deferred" | "cancelled"
      inspection_outcome: "pass" | "warn" | "fail"
      mission_stage:
        | "Home"
        | "Define"
        | "Prepare"
        | "Plan"
        | "Approve"
        | "Execute"
        | "Reflect"
      mission_status:
        | "draft"
        | "in_progress"
        | "ready"
        | "blocked"
        | "completed"
        | "archived"
      readiness_state:
        | "unknown"
        | "needs_auth"
        | "needs_data"
        | "blocked"
        | "degraded"
        | "ready"
      redaction_state: "not_required" | "applied" | "pending_review"
      safeguard_severity: "low" | "medium" | "high" | "critical"
      session_state: "active" | "idle" | "terminated"
      stage_progress_state:
        | "pending"
        | "in_progress"
        | "ready"
        | "blocked"
        | "completed"
      telemetry_level: "info" | "success" | "warning" | "error"
      undo_event_type:
        | "planned"
        | "available"
        | "requested"
        | "executed"
        | "failed"
      undo_plan_state: "draft" | "ready" | "executed" | "expired"
      undo_status: "pending" | "in_progress" | "completed" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          format: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          format?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          level: number | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      prefixes: {
        Row: {
          bucket_id: string
          created_at: string | null
          level: number
          name: string
          updated_at: string | null
        }
        Insert: {
          bucket_id: string
          created_at?: string | null
          level?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          bucket_id?: string
          created_at?: string | null
          level?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prefixes_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_prefixes: {
        Args: { _bucket_id: string; _name: string }
        Returns: undefined
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      delete_leaf_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      delete_prefix: {
        Args: { _bucket_id: string; _name: string }
        Returns: boolean
      }
      extension: {
        Args: { name: string }
        Returns: string
      }
      filename: {
        Args: { name: string }
        Returns: string
      }
      foldername: {
        Args: { name: string }
        Returns: string[]
      }
      get_level: {
        Args: { name: string }
        Returns: number
      }
      get_prefix: {
        Args: { name: string }
        Returns: string
      }
      get_prefixes: {
        Args: { name: string }
        Returns: string[]
      }
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          start_after?: string
        }
        Returns: {
          id: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      lock_top_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      operation: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_legacy_v1: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v1_optimised: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      approval_status: [
        "requested",
        "delegated",
        "approved",
        "rejected",
        "expired",
      ],
      connection_status: [
        "initiated",
        "approved",
        "expired",
        "revoked",
        "failed",
      ],
      followup_state: ["open", "in_progress", "done", "deferred", "cancelled"],
      inspection_outcome: ["pass", "warn", "fail"],
      mission_stage: [
        "Home",
        "Define",
        "Prepare",
        "Plan",
        "Approve",
        "Execute",
        "Reflect",
      ],
      mission_status: [
        "draft",
        "in_progress",
        "ready",
        "blocked",
        "completed",
        "archived",
      ],
      readiness_state: [
        "unknown",
        "needs_auth",
        "needs_data",
        "blocked",
        "degraded",
        "ready",
      ],
      redaction_state: ["not_required", "applied", "pending_review"],
      safeguard_severity: ["low", "medium", "high", "critical"],
      session_state: ["active", "idle", "terminated"],
      stage_progress_state: [
        "pending",
        "in_progress",
        "ready",
        "blocked",
        "completed",
      ],
      telemetry_level: ["info", "success", "warning", "error"],
      undo_event_type: [
        "planned",
        "available",
        "requested",
        "executed",
        "failed",
      ],
      undo_plan_state: ["draft", "ready", "executed", "expired"],
      undo_status: ["pending", "in_progress", "completed", "failed"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS"],
    },
  },
} as const
