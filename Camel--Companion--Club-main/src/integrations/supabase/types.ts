export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      institutional_confirmation_emails: {
        Row: {
          attempt_token: string | null;
          attempts: number;
          created_at: string;
          first_attempt_at: string | null;
          last_error: string | null;
          lease_until: string | null;
          license_id: string;
          next_attempt_at: string;
          order_id: string;
          payload: Json | null;
          provider_email_id: string | null;
          sent_at: string | null;
          status: string;
        };
        Insert: {
          attempt_token?: string | null;
          attempts?: number;
          created_at?: string;
          first_attempt_at?: string | null;
          last_error?: string | null;
          lease_until?: string | null;
          license_id: string;
          next_attempt_at?: string;
          order_id: string;
          payload?: Json | null;
          provider_email_id?: string | null;
          sent_at?: string | null;
          status?: string;
        };
        Update: {
          attempt_token?: string | null;
          attempts?: number;
          created_at?: string;
          first_attempt_at?: string | null;
          last_error?: string | null;
          lease_until?: string | null;
          license_id?: string;
          next_attempt_at?: string;
          order_id?: string;
          payload?: Json | null;
          provider_email_id?: string | null;
          sent_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "institutional_confirmation_emails_license_id_fkey";
            columns: ["license_id"];
            isOneToOne: false;
            referencedRelation: "institutional_licenses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "institutional_confirmation_emails_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "institutional_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      institutional_licenses: {
        Row: {
          activated_at: string;
          assignment_status: string;
          beneficiary_mode: string;
          billing_email: string;
          centre_count: number;
          centres: Json;
          environment: string;
          id: string;
          institution_name: string;
          order_id: string;
          package_id: string;
          status: string;
        };
        Insert: {
          activated_at?: string;
          assignment_status: string;
          beneficiary_mode: string;
          billing_email: string;
          centre_count: number;
          centres: Json;
          environment: string;
          id?: string;
          institution_name: string;
          order_id: string;
          package_id: string;
          status?: string;
        };
        Update: {
          activated_at?: string;
          assignment_status?: string;
          beneficiary_mode?: string;
          billing_email?: string;
          centre_count?: number;
          centres?: Json;
          environment?: string;
          id?: string;
          institution_name?: string;
          order_id?: string;
          package_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "institutional_licenses_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "institutional_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      institutional_orders: {
        Row: {
          access_hash: string;
          amount_cents: number;
          beneficiary_mode: string;
          billing_email: string;
          centre_count: number;
          centres: Json;
          created_at: string;
          currency: string;
          email_language: string;
          environment: string;
          id: string;
          institution_name: string;
          package_id: string;
          paid_at: string | null;
          request_key: string;
          status: string;
          stripe_expires_at: string | null;
          stripe_session_id: string | null;
        };
        Insert: {
          access_hash: string;
          amount_cents: number;
          beneficiary_mode: string;
          billing_email: string;
          centre_count: number;
          centres?: Json;
          created_at?: string;
          currency?: string;
          email_language?: string;
          environment: string;
          id?: string;
          institution_name: string;
          package_id: string;
          paid_at?: string | null;
          request_key: string;
          status?: string;
          stripe_expires_at?: string | null;
          stripe_session_id?: string | null;
        };
        Update: {
          access_hash?: string;
          amount_cents?: number;
          beneficiary_mode?: string;
          billing_email?: string;
          centre_count?: number;
          centres?: Json;
          created_at?: string;
          currency?: string;
          email_language?: string;
          environment?: string;
          id?: string;
          institution_name?: string;
          package_id?: string;
          paid_at?: string | null;
          request_key?: string;
          status?: string;
          stripe_expires_at?: string | null;
          stripe_session_id?: string | null;
        };
        Relationships: [];
      };
      institutional_sample_allocations: {
        Row: {
          centre_count: number;
          environment: string;
          package_id: string;
          sample_key: string;
        };
        Insert: {
          centre_count: number;
          environment?: string;
          package_id: string;
          sample_key: string;
        };
        Update: {
          centre_count?: number;
          environment?: string;
          package_id?: string;
          sample_key?: string;
        };
        Relationships: [];
      };
      intervention_plans: {
        Row: {
          action_detail: string;
          created_at: string;
          id: string;
          is_sample: boolean;
          notes: string;
          priority: string;
          reviewed: boolean;
          reviewed_at: string;
          school_id: string;
          status: string;
          student_id: string;
          support_action: string;
          teacher_id: string;
        };
        Insert: {
          action_detail?: string;
          created_at?: string;
          id?: string;
          is_sample?: boolean;
          notes: string;
          priority: string;
          reviewed: boolean;
          reviewed_at?: string;
          school_id: string;
          status?: string;
          student_id: string;
          support_action: string;
          teacher_id: string;
        };
        Update: {
          action_detail?: string;
          created_at?: string;
          id?: string;
          is_sample?: boolean;
          notes?: string;
          priority?: string;
          reviewed?: boolean;
          reviewed_at?: string;
          school_id?: string;
          status?: string;
          student_id?: string;
          support_action?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intervention_plans_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intervention_plans_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intervention_plans_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      intervention_proposals: {
        Row: {
          action_detail: string;
          created_at: string;
          id: string;
          is_sample: boolean;
          notes: string;
          priority: string;
          school_id: string;
          student_id: string;
          support_action: string;
          teacher_id: string;
        };
        Insert: {
          action_detail: string;
          created_at?: string;
          id?: string;
          is_sample?: boolean;
          notes?: string;
          priority: string;
          school_id: string;
          student_id: string;
          support_action: string;
          teacher_id: string;
        };
        Update: {
          action_detail?: string;
          created_at?: string;
          id?: string;
          is_sample?: boolean;
          notes?: string;
          priority?: string;
          school_id?: string;
          student_id?: string;
          support_action?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intervention_proposals_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intervention_proposals_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intervention_proposals_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      metric_history: {
        Row: {
          attendance: number;
          grade: number;
          id: string;
          recorded_at: string;
          resource_usage: number;
          student_id: string;
          submissions: number;
        };
        Insert: {
          attendance: number;
          grade: number;
          id?: string;
          recorded_at?: string;
          resource_usage: number;
          student_id: string;
          submissions: number;
        };
        Update: {
          attendance?: number;
          grade?: number;
          id?: string;
          recorded_at?: string;
          resource_usage?: number;
          student_id?: string;
          submissions?: number;
        };
        Relationships: [
          {
            foreignKeyName: "metric_history_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          display_name: string;
          id: string;
        };
        Insert: {
          display_name?: string;
          id: string;
        };
        Update: {
          display_name?: string;
          id?: string;
        };
        Relationships: [];
      };
      school_invites: {
        Row: {
          created_by: string;
          email: string;
          expires_at: string;
          id: string;
          role: Database["public"]["Enums"]["edu_role"];
          school_id: string;
          token: string;
          used_at: string | null;
        };
        Insert: {
          created_by: string;
          email: string;
          expires_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["edu_role"];
          school_id: string;
          token?: string;
          used_at?: string | null;
        };
        Update: {
          created_by?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["edu_role"];
          school_id?: string;
          token?: string;
          used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "school_invites_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      schools: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      students: {
        Row: {
          attendance: number;
          code: string;
          connectivity: string;
          course: string;
          created_at: string;
          enrollment_status: string;
          grade: number;
          id: string;
          is_sample: boolean;
          observations: string;
          resource_usage: number;
          school_id: string;
          submissions: number;
          teacher_id: string;
          updated_at: string;
        };
        Insert: {
          attendance: number;
          code: string;
          connectivity?: string;
          course: string;
          created_at?: string;
          enrollment_status?: string;
          grade: number;
          id?: string;
          is_sample?: boolean;
          observations?: string;
          resource_usage: number;
          school_id: string;
          submissions: number;
          teacher_id: string;
          updated_at?: string;
        };
        Update: {
          attendance?: number;
          code?: string;
          connectivity?: string;
          course?: string;
          created_at?: string;
          enrollment_status?: string;
          grade?: number;
          id?: string;
          is_sample?: boolean;
          observations?: string;
          resource_usage?: number;
          school_id?: string;
          submissions?: number;
          teacher_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          role: Database["public"]["Enums"]["edu_role"];
          school_id: string;
          user_id: string;
        };
        Insert: {
          role: Database["public"]["Enums"]["edu_role"];
          school_id: string;
          user_id: string;
        };
        Update: {
          role?: Database["public"]["Enums"]["edu_role"];
          school_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      edu_create_school: {
        Args: {
          chosen_role: Database["public"]["Enums"]["edu_role"];
          school_name: string;
        };
        Returns: string;
      };
      edu_dashboard: { Args: never; Returns: Json };
      edu_has_role: {
        Args: { wanted: Database["public"]["Enums"]["edu_role"] };
        Returns: boolean;
      };
      edu_invite: {
        Args: {
          invite_email: string;
          invite_role: Database["public"]["Enums"]["edu_role"];
        };
        Returns: string;
      };
      edu_join_school: { Args: { invite_token: string }; Returns: string };
      edu_school: { Args: never; Returns: string };
      edu_validate_proposal: {
        Args: {
          chosen_action: string;
          chosen_detail: string;
          chosen_notes: string;
          chosen_priority: string;
          confirmed_review: boolean;
          wanted_proposal: string;
        };
        Returns: string;
      };
      institutional_activate: {
        Args: {
          verified_amount: number;
          verified_currency: string;
          verified_environment: string;
          wanted_order: string;
          wanted_session: string;
        };
        Returns: string;
      };
      institutional_availability: {
        Args: { wanted_environment: string };
        Returns: {
          amount_cents: number;
          available: number;
          capacity: number;
          id: string;
          max_centres: number;
        }[];
      };
      institutional_claim_confirmation: {
        Args: { wanted_order?: string };
        Returns: {
          attempt_token: string | null;
          attempts: number;
          created_at: string;
          first_attempt_at: string | null;
          last_error: string | null;
          lease_until: string | null;
          license_id: string;
          next_attempt_at: string;
          order_id: string;
          payload: Json | null;
          provider_email_id: string | null;
          sent_at: string | null;
          status: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "institutional_confirmation_emails";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      institutional_finish_confirmation: {
        Args: {
          error_code?: string;
          provider_id?: string;
          wanted_order: string;
          wanted_token: string;
        };
        Returns: boolean;
      };
      institutional_package_catalog: {
        Args: never;
        Returns: {
          amount_cents: number;
          capacity: number;
          id: string;
          max_centres: number;
        }[];
      };
      institutional_reserve: {
        Args: {
          wanted_access_hash: string;
          wanted_centres: Json;
          wanted_count: number;
          wanted_email: string;
          wanted_environment: string;
          wanted_institution: string;
          wanted_mode: string;
          wanted_package: string;
          wanted_request: string;
        };
        Returns: {
          access_hash: string;
          amount_cents: number;
          beneficiary_mode: string;
          billing_email: string;
          centre_count: number;
          centres: Json;
          created_at: string;
          currency: string;
          email_language: string;
          environment: string;
          id: string;
          institution_name: string;
          package_id: string;
          paid_at: string | null;
          request_key: string;
          status: string;
          stripe_expires_at: string | null;
          stripe_session_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "institutional_orders";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      edu_role: "teacher" | "director";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      edu_role: ["teacher", "director"],
    },
  },
} as const;
