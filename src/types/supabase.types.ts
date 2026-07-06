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
      closet_collaborators: {
        Row: {
          closet_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          closet_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          closet_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "closet_collaborators_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closet_collaborators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      closets: {
        Row: {
          closet_name: string
          created_at: string
          id: string
          owner_id: string
          pass_phrase: string
        }
        Insert: {
          closet_name: string
          created_at?: string
          id?: string
          owner_id: string
          pass_phrase?: string
        }
        Update: {
          closet_name?: string
          created_at?: string
          id?: string
          owner_id?: string
          pass_phrase?: string
        }
        Relationships: [
          {
            foreignKeyName: "closets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clothing_item_photos: {
        Row: {
          clothing_item_id: string
          created_at: string
          id: string
          image_url: string
          is_primary: boolean
        }
        Insert: {
          clothing_item_id: string
          created_at?: string
          id?: string
          image_url: string
          is_primary?: boolean
        }
        Update: {
          clothing_item_id?: string
          created_at?: string
          id?: string
          image_url?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clothing_item_photos_clothing_item_id_fkey"
            columns: ["clothing_item_id"]
            isOneToOne: false
            referencedRelation: "clothing_items"
            referencedColumns: ["id"]
          },
        ]
      }
      clothing_items: {
        Row: {
          brand: string | null
          care_instructions: string | null
          closet_id: string
          created_at: string
          description: string | null
          fit_notes: string | null
          id: string
          item_type: string
          name: string
          purchase_url: string | null
        }
        Insert: {
          brand?: string | null
          care_instructions?: string | null
          closet_id: string
          created_at?: string
          description?: string | null
          fit_notes?: string | null
          id?: string
          item_type: string
          name: string
          purchase_url?: string | null
        }
        Update: {
          brand?: string | null
          care_instructions?: string | null
          closet_id?: string
          created_at?: string
          description?: string | null
          fit_notes?: string | null
          id?: string
          item_type?: string
          name?: string
          purchase_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clothing_items_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closets"
            referencedColumns: ["id"]
          },
        ]
      }
      outfit_items: {
        Row: {
          clothing_item_id: string
          outfit_id: string
        }
        Insert: {
          clothing_item_id: string
          outfit_id: string
        }
        Update: {
          clothing_item_id?: string
          outfit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_items_clothing_item_id_fkey"
            columns: ["clothing_item_id"]
            isOneToOne: false
            referencedRelation: "clothing_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      outfit_photos: {
        Row: {
          created_at: string
          id: string
          image_url: string
          outfit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          outfit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          outfit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_photos_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      outfits: {
        Row: {
          closet_id: string
          compliment_count: number
          created_at: string
          created_by_user_id: string | null
          description: string | null
          id: string
          labels: string[]
          name: string
        }
        Insert: {
          closet_id: string
          compliment_count?: number
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          labels?: string[]
          name: string
        }
        Update: {
          closet_id?: string
          compliment_count?: number
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          labels?: string[]
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfits_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfits_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      wear_logs: {
        Row: {
          closet_id: string
          clothing_item_id: string | null
          id: string
          outfit_id: string | null
          user_id: string
          worn_on_date: string
        }
        Insert: {
          closet_id: string
          clothing_item_id?: string | null
          id?: string
          outfit_id?: string | null
          user_id: string
          worn_on_date?: string
        }
        Update: {
          closet_id?: string
          clothing_item_id?: string | null
          id?: string
          outfit_id?: string | null
          user_id?: string
          worn_on_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "wear_logs_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wear_logs_clothing_item_id_fkey"
            columns: ["clothing_item_id"]
            isOneToOne: false
            referencedRelation: "clothing_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wear_logs_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wear_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_closet_member: { Args: { target_closet_id: string }; Returns: boolean }
      is_closet_owner: { Args: { target_closet_id: string }; Returns: boolean }
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
