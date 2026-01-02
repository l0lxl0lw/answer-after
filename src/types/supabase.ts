export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      appointment_reminders: {
        Row: {
          appointment_id: string
          call_duration_seconds: number | null
          created_at: string
          id: string
          institution_id: string
          notes: string | null
          reminder_number: number
          reminder_type: string
          response: string | null
          scheduled_time: string
          status: string
          twilio_call_sid: string | null
          updated_at: string
        }
        Insert: {
          appointment_id: string
          call_duration_seconds?: number | null
          created_at?: string
          id?: string
          institution_id: string
          notes?: string | null
          reminder_number: number
          reminder_type?: string
          response?: string | null
          scheduled_time: string
          status?: string
          twilio_call_sid?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          call_duration_seconds?: number | null
          created_at?: string
          id?: string
          institution_id?: string
          notes?: string | null
          reminder_number?: number
          reminder_type?: string
          response?: string | null
          scheduled_time?: string
          status?: string
          twilio_call_sid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_organization_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_appointment_reminders_appointment"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          calendar_event_id: string | null
          call_id: string | null
          created_at: string
          customer_address: string | null
          customer_name: string
          customer_phone: string
          id: string
          institution_id: string
          is_emergency: boolean
          issue_description: string
          nexhealth_appointment_id: string | null
          nexhealth_operatory_id: string | null
          nexhealth_patient_id: string | null
          notes: string | null
          provider_id: string | null
          scheduled_end: string
          scheduled_start: string
          service_id: string | null
          service_price_cents: number | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          calendar_event_id?: string | null
          call_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          institution_id: string
          is_emergency?: boolean
          issue_description: string
          nexhealth_appointment_id?: string | null
          nexhealth_operatory_id?: string | null
          nexhealth_patient_id?: string | null
          notes?: string | null
          provider_id?: string | null
          scheduled_end: string
          scheduled_start: string
          service_id?: string | null
          service_price_cents?: number | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          calendar_event_id?: string | null
          call_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          institution_id?: string
          is_emergency?: boolean
          issue_description?: string
          nexhealth_appointment_id?: string | null
          nexhealth_operatory_id?: string | null
          nexhealth_patient_id?: string | null
          notes?: string | null
          provider_id?: string | null
          scheduled_end?: string
          scheduled_start?: string
          service_id?: string | null
          service_price_cents?: number | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          appointment_id: string | null
          color: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          end_time: string
          external_calendar_id: string | null
          external_id: string | null
          external_updated_at: string | null
          id: string
          institution_id: string
          last_synced_at: string | null
          provider_id: string | null
          source: string
          start_time: string
          status: string
          sync_status: string
          title: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          color?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          end_time: string
          external_calendar_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          id?: string
          institution_id: string
          last_synced_at?: string | null
          provider_id?: string | null
          source: string
          start_time: string
          status?: string
          sync_status?: string
          title: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          color?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          end_time?: string
          external_calendar_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          id?: string
          institution_id?: string
          last_synced_at?: string | null
          provider_id?: string | null
          source?: string
          start_time?: string
          status?: string
          sync_status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_organization_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_sync_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          event_id: string | null
          id: string
          institution_id: string
          source: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          event_id?: string | null
          id?: string
          institution_id: string
          source: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          event_id?: string | null
          id?: string
          institution_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sync_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_sync_log_organization_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_events: {
        Row: {
          ai_prompt: string | null
          ai_response: string | null
          call_id: string
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
        }
        Insert: {
          ai_prompt?: string | null
          ai_response?: string | null
          call_id: string
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
        }
        Update: {
          ai_prompt?: string | null
          ai_response?: string | null
          call_id?: string
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transcripts: {
        Row: {
          call_id: string
          confidence: number | null
          content: string
          created_at: string
          id: string
          speaker: string
          timestamp_ms: number | null
        }
        Insert: {
          call_id: string
          confidence?: number | null
          content: string
          created_at?: string
          id?: string
          speaker: string
          timestamp_ms?: number | null
        }
        Update: {
          call_id?: string
          confidence?: number | null
          content?: string
          created_at?: string
          id?: string
          speaker?: string
          timestamp_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          caller_name: string | null
          caller_phone: string
          contact_id: string | null
          created_at: string
          duration_seconds: number | null
          elevenlabs_conversation_id: string | null
          ended_at: string | null
          id: string
          institution_id: string
          interest_level: Database["public"]["Enums"]["interest_level"] | null
          is_emergency: boolean
          lead_notes: string | null
          lead_status: Database["public"]["Enums"]["lead_status"] | null
          lead_updated_at: string | null
          outcome: Database["public"]["Enums"]["call_outcome"] | null
          phone_number_id: string | null
          recording_url: string | null
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
          summary: string | null
          twilio_call_sid: string | null
          updated_at: string
        }
        Insert: {
          caller_name?: string | null
          caller_phone: string
          contact_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          elevenlabs_conversation_id?: string | null
          ended_at?: string | null
          id?: string
          institution_id: string
          interest_level?: Database["public"]["Enums"]["interest_level"] | null
          is_emergency?: boolean
          lead_notes?: string | null
          lead_status?: Database["public"]["Enums"]["lead_status"] | null
          lead_updated_at?: string | null
          outcome?: Database["public"]["Enums"]["call_outcome"] | null
          phone_number_id?: string | null
          recording_url?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          summary?: string | null
          twilio_call_sid?: string | null
          updated_at?: string
        }
        Update: {
          caller_name?: string | null
          caller_phone?: string
          contact_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          elevenlabs_conversation_id?: string | null
          ended_at?: string | null
          id?: string
          institution_id?: string
          interest_level?: Database["public"]["Enums"]["interest_level"] | null
          is_emergency?: boolean
          lead_notes?: string | null
          lead_status?: Database["public"]["Enums"]["lead_status"] | null
          lead_updated_at?: string | null
          outcome?: Database["public"]["Enums"]["call_outcome"] | null
          phone_number_id?: string | null
          recording_url?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          summary?: string | null
          twilio_call_sid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_organization_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          institution_id: string
          interest_level: Database["public"]["Enums"]["interest_level"] | null
          lead_notes: string | null
          lead_status: Database["public"]["Enums"]["lead_status"] | null
          lead_updated_at: string | null
          name: string | null
          nexhealth_patient_id: string | null
          notes: string | null
          phone: string
          source: Database["public"]["Enums"]["contact_source"]
          status: Database["public"]["Enums"]["contact_status"]
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          institution_id: string
          interest_level?: Database["public"]["Enums"]["interest_level"] | null
          lead_notes?: string | null
          lead_status?: Database["public"]["Enums"]["lead_status"] | null
          lead_updated_at?: string | null
          name?: string | null
          nexhealth_patient_id?: string | null
          notes?: string | null
          phone: string
          source?: Database["public"]["Enums"]["contact_source"]
          status?: Database["public"]["Enums"]["contact_status"]
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          institution_id?: string
          interest_level?: Database["public"]["Enums"]["interest_level"] | null
          lead_notes?: string | null
          lead_status?: Database["public"]["Enums"]["lead_status"] | null
          lead_updated_at?: string | null
          name?: string | null
          nexhealth_patient_id?: string | null
          notes?: string | null
          phone?: string
          source?: Database["public"]["Enums"]["contact_source"]
          status?: Database["public"]["Enums"]["contact_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_config: {
        Row: {
          config_key: string
          config_value: number
          created_at: string
          description: string | null
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value: number
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: number
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string
          id: string
          key: string
          processed_at: string
          result: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          processed_at?: string
          result?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          processed_at?: string
          result?: Json | null
        }
        Relationships: []
      }
      institution_agents: {
        Row: {
          context: string | null
          created_at: string
          elevenlabs_agent_id: string | null
          elevenlabs_calendar_tool_id: string | null
          elevenlabs_lookup_contact_tool_id: string | null
          elevenlabs_save_contact_tool_id: string | null
          id: string
          institution_id: string
          updated_at: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          elevenlabs_agent_id?: string | null
          elevenlabs_calendar_tool_id?: string | null
          elevenlabs_lookup_contact_tool_id?: string | null
          elevenlabs_save_contact_tool_id?: string | null
          id?: string
          institution_id: string
          updated_at?: string
        }
        Update: {
          context?: string | null
          created_at?: string
          elevenlabs_agent_id?: string | null
          elevenlabs_calendar_tool_id?: string | null
          elevenlabs_lookup_contact_tool_id?: string | null
          elevenlabs_save_contact_tool_id?: string | null
          id?: string
          institution_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_agents_organization_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          business_hours_end: string | null
          business_hours_schedule: Json | null
          business_hours_start: string | null
          business_phone_number: string | null
          created_at: string
          emergency_keywords: string[] | null
          id: string
          is_onboarding_complete: boolean
          name: string
          nexhealth_enabled: boolean
          nexhealth_location_id: string | null
          nexhealth_subdomain: string | null
          notification_email: string | null
          notification_phone: string | null
          onboarding_completed_at: string | null
          slug: string
          timezone: string
          twilio_subaccount_auth_token: string | null
          twilio_subaccount_sid: string | null
          updated_at: string
        }
        Insert: {
          business_hours_end?: string | null
          business_hours_schedule?: Json | null
          business_hours_start?: string | null
          business_phone_number?: string | null
          created_at?: string
          emergency_keywords?: string[] | null
          id?: string
          is_onboarding_complete?: boolean
          name: string
          nexhealth_enabled?: boolean
          nexhealth_location_id?: string | null
          nexhealth_subdomain?: string | null
          notification_email?: string | null
          notification_phone?: string | null
          onboarding_completed_at?: string | null
          slug: string
          timezone?: string
          twilio_subaccount_auth_token?: string | null
          twilio_subaccount_sid?: string | null
          updated_at?: string
        }
        Update: {
          business_hours_end?: string | null
          business_hours_schedule?: Json | null
          business_hours_start?: string | null
          business_phone_number?: string | null
          created_at?: string
          emergency_keywords?: string[] | null
          id?: string
          is_onboarding_complete?: boolean
          name?: string
          nexhealth_enabled?: boolean
          nexhealth_location_id?: string | null
          nexhealth_subdomain?: string | null
          notification_email?: string | null
          notification_phone?: string | null
          onboarding_completed_at?: string | null
          slug?: string
          timezone?: string
          twilio_subaccount_auth_token?: string | null
          twilio_subaccount_sid?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      phone_numbers: {
        Row: {
          created_at: string
          elevenlabs_phone_number_id: string | null
          friendly_name: string | null
          id: string
          institution_id: string
          is_active: boolean
          is_after_hours_only: boolean
          is_shared: boolean
          phone_number: string
          provisioned_at: string | null
          twilio_sid: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          elevenlabs_phone_number_id?: string | null
          friendly_name?: string | null
          id?: string
          institution_id: string
          is_active?: boolean
          is_after_hours_only?: boolean
          is_shared?: boolean
          phone_number: string
          provisioned_at?: string | null
          twilio_sid?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          elevenlabs_phone_number_id?: string | null
          friendly_name?: string | null
          id?: string
          institution_id?: string
          is_active?: boolean
          is_after_hours_only?: boolean
          is_shared?: boolean
          phone_number?: string
          provisioned_at?: string | null
          twilio_sid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_organization_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          email_verified: boolean
          full_name: string
          id: string
          institution_id: string | null
          is_active: boolean
          phone: string | null
          phone_verified: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          email_verified?: boolean
          full_name: string
          id: string
          institution_id?: string | null
          is_active?: boolean
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          email_verified?: boolean
          full_name?: string
          id?: string
          institution_id?: string | null
          is_active?: boolean
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          template: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          template: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          template?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_roles: {
        Row: {
          created_at: string
          display_order: number
          id: string
          institution_id: string
          is_default: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          institution_id: string
          is_default?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          institution_id?: string
          is_default?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_roles_organization_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_schedule_overrides: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          is_available: boolean
          override_date: string
          provider_id: string
          reason: string | null
          start_time: string | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          is_available: boolean
          override_date: string
          provider_id: string
          reason?: string | null
          start_time?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          is_available?: boolean
          override_date?: string
          provider_id?: string
          reason?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_schedule_overrides_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean
          provider_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean
          provider_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean
          provider_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_schedules_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          color: string | null
          created_at: string
          email: string | null
          external_id: string | null
          id: string
          institution_id: string
          is_active: boolean
          name: string
          phone: string | null
          role: string | null
          role_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          institution_id: string
          is_active?: boolean
          name: string
          phone?: string | null
          role?: string | null
          role_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          institution_id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          role?: string | null
          role_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_organization_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "providers_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "provider_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "providers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchased_credits: {
        Row: {
          created_at: string
          credits_purchased: number
          credits_remaining: number
          id: string
          institution_id: string
          price_cents: number
          purchased_at: string
          stripe_payment_intent_id: string | null
        }
        Insert: {
          created_at?: string
          credits_purchased: number
          credits_remaining: number
          id?: string
          institution_id: string
          price_cents: number
          purchased_at?: string
          stripe_payment_intent_id?: string | null
        }
        Update: {
          created_at?: string
          credits_purchased?: number
          credits_remaining?: number
          id?: string
          institution_id?: string
          price_cents?: number
          purchased_at?: string
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchased_credits_organization_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          institution_id: string
          is_active: boolean
          name: string
          price_cents: number
          provider_roles: string[] | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          institution_id: string
          is_active?: boolean
          name: string
          price_cents?: number
          provider_roles?: string[] | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          institution_id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          provider_roles?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_tiers: {
        Row: {
          created_at: string
          credits: number
          credits_cost_per_thousand: number | null
          description: string
          display_order: number
          features: Json
          has_api_access: boolean
          has_call_recordings: boolean
          has_custom_agent: boolean
          has_custom_ai_training: boolean
          has_hipaa_compliance: boolean
          has_multi_language: boolean
          has_outbound_reminders: boolean
          has_priority_support: boolean
          has_sla_guarantee: boolean
          has_voice_selection: boolean
          id: string
          is_active: boolean
          is_popular: boolean
          is_visible: boolean
          name: string
          period: string
          plan_id: string
          price_cents: number
          stripe_monthly_price_id: string | null
          support_level: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits?: number
          credits_cost_per_thousand?: number | null
          description: string
          display_order?: number
          features?: Json
          has_api_access?: boolean
          has_call_recordings?: boolean
          has_custom_agent?: boolean
          has_custom_ai_training?: boolean
          has_hipaa_compliance?: boolean
          has_multi_language?: boolean
          has_outbound_reminders?: boolean
          has_priority_support?: boolean
          has_sla_guarantee?: boolean
          has_voice_selection?: boolean
          id?: string
          is_active?: boolean
          is_popular?: boolean
          is_visible?: boolean
          name: string
          period?: string
          plan_id: string
          price_cents?: number
          stripe_monthly_price_id?: string | null
          support_level?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          credits_cost_per_thousand?: number | null
          description?: string
          display_order?: number
          features?: Json
          has_api_access?: boolean
          has_call_recordings?: boolean
          has_custom_agent?: boolean
          has_custom_ai_training?: boolean
          has_hipaa_compliance?: boolean
          has_multi_language?: boolean
          has_outbound_reminders?: boolean
          has_priority_support?: boolean
          has_sla_guarantee?: boolean
          has_voice_selection?: boolean
          id?: string
          is_active?: boolean
          is_popular?: boolean
          is_visible?: boolean
          name?: string
          period?: string
          plan_id?: string
          price_cents?: number
          stripe_monthly_price_id?: string | null
          support_level?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          institution_id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          total_credits: number
          updated_at: string
          used_credits: number
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          institution_id: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          total_credits?: number
          updated_at?: string
          used_credits?: number
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          institution_id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          total_credits?: number
          updated_at?: string
          used_credits?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "subscription_tiers"
            referencedColumns: ["plan_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_roles_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          phone: string | null
          type: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          phone?: string | null
          type: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          phone?: string | null
          type?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_verification_codes_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_idempotency_keys: { Args: never; Returns: undefined }
      get_role_usage_count: { Args: { role_uuid: string }; Returns: number }
      get_user_institution_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      seed_default_provider_roles: {
        Args: { org_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "staff"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      call_outcome:
        | "booked"
        | "callback_requested"
        | "information_provided"
        | "escalated"
        | "no_action"
        | "voicemail"
      call_status: "active" | "completed" | "failed" | "voicemail"
      contact_source: "inbound_call" | "manual" | "import"
      contact_status: "lead" | "customer"
      interest_level: "hot" | "warm" | "cold"
      lead_status: "new" | "contacted" | "converted" | "lost"
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
      app_role: ["owner", "admin", "staff"],
      appointment_status: [
        "scheduled",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      call_outcome: [
        "booked",
        "callback_requested",
        "information_provided",
        "escalated",
        "no_action",
        "voicemail",
      ],
      call_status: ["active", "completed", "failed", "voicemail"],
      contact_source: ["inbound_call", "manual", "import"],
      contact_status: ["lead", "customer"],
      interest_level: ["hot", "warm", "cold"],
      lead_status: ["new", "contacted", "converted", "lost"],
    },
  },
} as const

