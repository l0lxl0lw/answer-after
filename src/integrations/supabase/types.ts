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
          notes: string | null
          organization_id: string
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
          notes?: string | null
          organization_id: string
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
          notes?: string | null
          organization_id?: string
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
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          call_id: string | null
          created_at: string
          customer_address: string | null
          customer_name: string
          customer_phone: string
          id: string
          is_emergency: boolean
          issue_description: string
          notes: string | null
          organization_id: string
          scheduled_end: string
          scheduled_start: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          call_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          is_emergency?: boolean
          issue_description: string
          notes?: string | null
          organization_id: string
          scheduled_end: string
          scheduled_start: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          call_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          is_emergency?: boolean
          issue_description?: string
          notes?: string | null
          organization_id?: string
          scheduled_end?: string
          scheduled_start?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          is_emergency: boolean
          organization_id: string
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
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_emergency?: boolean
          organization_id: string
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
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_emergency?: boolean
          organization_id?: string
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
            foreignKeyName: "calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      google_calendar_connections: {
        Row: {
          access_token: string
          connected_at: string | null
          connected_email: string | null
          created_at: string | null
          id: string
          organization_id: string
          refresh_token: string
          selected_calendars: string[] | null
          token_expires_at: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          connected_at?: string | null
          connected_email?: string | null
          created_at?: string | null
          id?: string
          organization_id: string
          refresh_token: string
          selected_calendars?: string[] | null
          token_expires_at: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          connected_at?: string | null
          connected_email?: string | null
          created_at?: string | null
          id?: string
          organization_id?: string
          refresh_token?: string
          selected_calendars?: string[] | null
          token_expires_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_agents: {
        Row: {
          context: string | null
          created_at: string
          elevenlabs_agent_id: string | null
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          elevenlabs_agent_id?: string | null
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          context?: string | null
          created_at?: string
          elevenlabs_agent_id?: string | null
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_agents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          business_hours_end: string | null
          business_hours_schedule: Json | null
          business_hours_start: string | null
          created_at: string
          emergency_keywords: string[] | null
          id: string
          is_onboarding_complete: boolean
          name: string
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
          created_at?: string
          emergency_keywords?: string[] | null
          id?: string
          is_onboarding_complete?: boolean
          name: string
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
          created_at?: string
          emergency_keywords?: string[] | null
          id?: string
          is_onboarding_complete?: boolean
          name?: string
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
          is_active: boolean
          is_after_hours_only: boolean
          is_shared: boolean
          organization_id: string
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
          is_active?: boolean
          is_after_hours_only?: boolean
          is_shared?: boolean
          organization_id: string
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
          is_active?: boolean
          is_after_hours_only?: boolean
          is_shared?: boolean
          organization_id?: string
          phone_number?: string
          provisioned_at?: string | null
          twilio_sid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          is_active: boolean
          organization_id: string | null
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
          is_active?: boolean
          organization_id?: string | null
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
          is_active?: boolean
          organization_id?: string | null
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      purchased_credits: {
        Row: {
          created_at: string
          credits_purchased: number
          credits_remaining: number
          id: string
          organization_id: string
          price_cents: number
          purchased_at: string
          stripe_payment_intent_id: string | null
        }
        Insert: {
          created_at?: string
          credits_purchased: number
          credits_remaining: number
          id?: string
          organization_id: string
          price_cents: number
          purchased_at?: string
          stripe_payment_intent_id?: string | null
        }
        Update: {
          created_at?: string
          credits_purchased?: number
          credits_remaining?: number
          id?: string
          organization_id?: string
          price_cents?: number
          purchased_at?: string
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchased_credits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          base_price_cents: number
          category: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          base_price_cents?: number
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          base_price_cents?: number
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          has_outbound_reminders: boolean
          has_priority_support: boolean
          has_sla_guarantee: boolean
          id: string
          is_active: boolean
          is_popular: boolean
          is_visible: boolean
          name: string
          period: string
          phone_lines: number
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
          has_outbound_reminders?: boolean
          has_priority_support?: boolean
          has_sla_guarantee?: boolean
          id?: string
          is_active?: boolean
          is_popular?: boolean
          is_visible?: boolean
          name: string
          period?: string
          phone_lines?: number
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
          has_outbound_reminders?: boolean
          has_priority_support?: boolean
          has_sla_guarantee?: boolean
          id?: string
          is_active?: boolean
          is_popular?: boolean
          is_visible?: boolean
          name?: string
          period?: string
          phone_lines?: number
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
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
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
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
        Relationships: []
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
    },
  },
} as const

