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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          address: string | null
          company_name: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          gst_number: string | null
          id: string
          monthly_package_value: number | null
          name: string
          notes: string | null
          phone: string | null
          start_date: string | null
          status: string
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          monthly_package_value?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          monthly_package_value?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_ifsc: string | null
          bank_name: string | null
          company_name: string | null
          email: string | null
          gst_number: string | null
          invoice_prefix: string | null
          logo_url: string | null
          pan_number: string | null
          phone: string | null
          quotation_prefix: string | null
          updated_at: string
          upi_id: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          company_name?: string | null
          email?: string | null
          gst_number?: string | null
          invoice_prefix?: string | null
          logo_url?: string | null
          pan_number?: string | null
          phone?: string | null
          quotation_prefix?: string | null
          updated_at?: string
          upi_id?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          company_name?: string | null
          email?: string | null
          gst_number?: string | null
          invoice_prefix?: string | null
          logo_url?: string | null
          pan_number?: string | null
          phone?: string | null
          quotation_prefix?: string | null
          updated_at?: string
          upi_id?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string | null
          client_id: string | null
          created_at: string
          id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          category?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          category?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          deleted_at: string | null
          expense_date: string
          id: string
          notes: string | null
          receipt_url: string | null
          user_id: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          deleted_at?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          user_id: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          deleted_at?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          user_id?: string
          vendor?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          deleted_at: string | null
          discount: number
          due_date: string | null
          gst_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          items: Json
          notes: string | null
          paid_amount: number
          status: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          deleted_at?: string | null
          discount?: number
          due_date?: string | null
          gst_amount?: number
          id?: string
          invoice_date?: string
          invoice_number: string
          items?: Json
          notes?: string | null
          paid_amount?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          deleted_at?: string | null
          discount?: number
          due_date?: string | null
          gst_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          items?: Json
          notes?: string | null
          paid_amount?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          addons: Json
          amount: number
          client_id: string
          created_at: string
          deleted_at: string | null
          entry_date: string
          id: string
          invoice_id: string | null
          invoice_status: string
          notes: string | null
          payment_status: string
          service_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          addons?: Json
          amount?: number
          client_id: string
          created_at?: string
          deleted_at?: string | null
          entry_date?: string
          id?: string
          invoice_id?: string | null
          invoice_status?: string
          notes?: string | null
          payment_status?: string
          service_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          addons?: Json
          amount?: number
          client_id?: string
          created_at?: string
          deleted_at?: string | null
          entry_date?: string
          id?: string
          invoice_id?: string | null
          invoice_status?: string
          notes?: string | null
          payment_status?: string
          service_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      letter_templates: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          kind: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          client_id: string | null
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          invoice_id: string | null
          method: string
          notes: string | null
          payment_date: string
          user_id: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          invoice_id?: string | null
          method?: string
          notes?: string | null
          payment_date?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          invoice_id?: string | null
          method?: string
          notes?: string | null
          payment_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          client_id: string | null
          created_at: string
          deleted_at: string | null
          discount: number
          gst_amount: number
          id: string
          items: Json
          notes: string | null
          quotation_number: string
          quote_date: string
          status: string
          subtotal: number
          total: number
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          deleted_at?: string | null
          discount?: number
          gst_amount?: number
          id?: string
          items?: Json
          notes?: string | null
          quotation_number: string
          quote_date?: string
          status?: string
          subtotal?: number
          total?: number
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          deleted_at?: string | null
          discount?: number
          gst_amount?: number
          id?: string
          items?: Json
          notes?: string | null
          quotation_number?: string
          quote_date?: string
          status?: string
          subtotal?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          client_id: string | null
          completed: boolean
          created_at: string
          deleted_at: string | null
          id: string
          priority: string
          remind_date: string
          remind_time: string | null
          title: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          completed?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          priority?: string
          remind_date?: string
          remind_time?: string | null
          title: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          completed?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          priority?: string
          remind_date?: string
          remind_time?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      salaries: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          employee_name: string
          id: string
          method: string | null
          notes: string | null
          pay_date: string
          pay_period: string | null
          role: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          employee_name: string
          id?: string
          method?: string | null
          notes?: string | null
          pay_date?: string
          pay_period?: string | null
          role?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          employee_name?: string
          id?: string
          method?: string | null
          notes?: string | null
          pay_date?: string
          pay_period?: string | null
          role?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
