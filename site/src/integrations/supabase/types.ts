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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      area_manager_audits: {
        Row: {
          area_manager_name: string
          area_manager_notes: string | null
          area_manager_signature: string | null
          area_ratings: Json
          audit_date: string
          average_area_score: number | null
          average_satisfaction_score: number | null
          branch_manager_name: string | null
          branch_manager_role: string | null
          branch_manager_signature: string | null
          branch_name: string
          cleaner_name: string | null
          created_at: string
          customer_notes: string | null
          equipment_status: Json
          id: string
          satisfaction_ratings: Json
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          area_manager_name: string
          area_manager_notes?: string | null
          area_manager_signature?: string | null
          area_ratings?: Json
          audit_date?: string
          average_area_score?: number | null
          average_satisfaction_score?: number | null
          branch_manager_name?: string | null
          branch_manager_role?: string | null
          branch_manager_signature?: string | null
          branch_name: string
          cleaner_name?: string | null
          created_at?: string
          customer_notes?: string | null
          equipment_status?: Json
          id?: string
          satisfaction_ratings?: Json
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          area_manager_name?: string
          area_manager_notes?: string | null
          area_manager_signature?: string | null
          area_ratings?: Json
          audit_date?: string
          average_area_score?: number | null
          average_satisfaction_score?: number | null
          branch_manager_name?: string | null
          branch_manager_role?: string | null
          branch_manager_signature?: string | null
          branch_name?: string
          cleaner_name?: string | null
          created_at?: string
          customer_notes?: string | null
          equipment_status?: Json
          id?: string
          satisfaction_ratings?: Json
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          client_id: string
          contact_name: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          client_id: string
          contact_name?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          client_id?: string
          contact_name?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invoices: {
        Row: {
          amount: number
          client_user_id: string
          created_at: string
          created_by: string
          description: string | null
          file_url: string | null
          id: string
          invoice_date: string
          invoice_number: string
          status: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          client_user_id: string
          created_at?: string
          created_by: string
          description?: string | null
          file_url?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          client_user_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          file_url?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      client_item_mappings: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          internal_item_id: string
          supplier_catalog_item_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          internal_item_id: string
          supplier_catalog_item_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          internal_item_id?: string
          supplier_catalog_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_item_mappings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_item_mappings_internal_item_id_fkey"
            columns: ["internal_item_id"]
            isOneToOne: false
            referencedRelation: "internal_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_item_mappings_supplier_catalog_item_id_fkey"
            columns: ["supplier_catalog_item_id"]
            isOneToOne: false
            referencedRelation: "public_price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_item_mappings_supplier_catalog_item_id_fkey"
            columns: ["supplier_catalog_item_id"]
            isOneToOne: false
            referencedRelation: "supplier_catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      client_logos: {
        Row: {
          alt_text: string | null
          created_at: string
          file_name: string | null
          file_url: string
          id: string
          slot_number: number
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          file_name?: string | null
          file_url: string
          id?: string
          slot_number: number
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          file_name?: string | null
          file_url?: string
          id?: string
          slot_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          auto_send_report: boolean | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          auto_send_report?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          auto_send_report?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      complaint_attachments: {
        Row: {
          complaint_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_attachments_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          branch_name: string
          city: string
          complaint_description: string
          created_at: string
          created_by: string
          customer_name: string
          customer_phone: string
          history_log: Json | null
          id: string
          incident_date: string
          manager_id: string
          manager_name: string
          notes: string | null
          resolution_details: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_name: string
          city: string
          complaint_description: string
          created_at?: string
          created_by: string
          customer_name: string
          customer_phone: string
          history_log?: Json | null
          id?: string
          incident_date: string
          manager_id: string
          manager_name: string
          notes?: string | null
          resolution_details?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_name?: string
          city?: string
          complaint_description?: string
          created_at?: string
          created_by?: string
          customer_name?: string
          customer_phone?: string
          history_log?: Json | null
          id?: string
          incident_date?: string
          manager_id?: string
          manager_name?: string
          notes?: string | null
          resolution_details?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_inquiries: {
        Row: {
          company: string | null
          created_at: string
          email: string
          full_name: string
          handled_at: string | null
          handled_by: string | null
          handling_notes: string | null
          id: string
          message: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          full_name: string
          handled_at?: string | null
          handled_by?: string | null
          handling_notes?: string | null
          id?: string
          message: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          full_name?: string
          handled_at?: string | null
          handled_by?: string | null
          handling_notes?: string | null
          id?: string
          message?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_surveys: {
        Row: {
          assigned_manager_id: string | null
          branch_name: string
          chain_name: string
          created_at: string
          customer_phone: string
          extra_ratings: Json
          free_text: string | null
          id: string
          manager_name: string
          rating_cleanliness: number
          rating_issue_handling: number
          rating_manager_service: number
          rating_overall: number
          rating_punctuality: number
          respondent_name: string | null
          respondent_role: string | null
          template_id: string | null
        }
        Insert: {
          assigned_manager_id?: string | null
          branch_name: string
          chain_name: string
          created_at?: string
          customer_phone: string
          extra_ratings?: Json
          free_text?: string | null
          id?: string
          manager_name: string
          rating_cleanliness: number
          rating_issue_handling: number
          rating_manager_service: number
          rating_overall: number
          rating_punctuality: number
          respondent_name?: string | null
          respondent_role?: string | null
          template_id?: string | null
        }
        Update: {
          assigned_manager_id?: string | null
          branch_name?: string
          chain_name?: string
          created_at?: string
          customer_phone?: string
          extra_ratings?: Json
          free_text?: string | null
          id?: string
          manager_name?: string
          rating_cleanliness?: number
          rating_issue_handling?: number
          rating_manager_service?: number
          rating_overall?: number
          rating_punctuality?: number
          respondent_name?: string | null
          respondent_role?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_surveys_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "public_survey_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_surveys_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          cost: number | null
          created_at: string | null
          document_type: string
          driver_id: string | null
          expiry_date: string | null
          file_name: string | null
          file_url: string
          id: string
          notes: string | null
          updated_at: string | null
          uploaded_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          document_type: string
          driver_id?: string | null
          expiry_date?: string | null
          file_name?: string | null
          file_url: string
          id?: string
          notes?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          document_type?: string
          driver_id?: string | null
          expiry_date?: string | null
          file_name?: string | null
          file_url?: string
          id?: string
          notes?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: []
      }
      employee_form_submissions: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          employee_id: string | null
          employee_name: string | null
          employee_number: string | null
          fillout_form_id: string | null
          fillout_submission_id: string | null
          fillout_submission_url: string | null
          fillout_viewer_url: string | null
          final_pdf_path: string | null
          final_pdf_url: string | null
          form_name: string | null
          form_type: string
          google_drive_file_id: string | null
          google_drive_folder_id: string | null
          id: string
          identification_number: string | null
          identification_type: string | null
          phone: string | null
          received_at: string
          status: string
          submission_data: Json
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          employee_id?: string | null
          employee_name?: string | null
          employee_number?: string | null
          fillout_form_id?: string | null
          fillout_submission_id?: string | null
          fillout_submission_url?: string | null
          fillout_viewer_url?: string | null
          final_pdf_path?: string | null
          final_pdf_url?: string | null
          form_name?: string | null
          form_type: string
          google_drive_file_id?: string | null
          google_drive_folder_id?: string | null
          id?: string
          identification_number?: string | null
          identification_type?: string | null
          phone?: string | null
          received_at?: string
          status?: string
          submission_data?: Json
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          employee_id?: string | null
          employee_name?: string | null
          employee_number?: string | null
          fillout_form_id?: string | null
          fillout_submission_id?: string | null
          fillout_submission_url?: string | null
          fillout_viewer_url?: string | null
          final_pdf_path?: string | null
          final_pdf_url?: string | null
          form_name?: string | null
          form_type?: string
          google_drive_file_id?: string | null
          google_drive_folder_id?: string | null
          id?: string
          identification_number?: string | null
          identification_type?: string | null
          phone?: string | null
          received_at?: string
          status?: string
          submission_data?: Json
          updated_at?: string
        }
        Relationships: []
      }
      equipment_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sano_price: number
          sano_sku: string | null
          sano_units_per_package: number
          shai_yuval_price: number
          shai_yuval_sku: string | null
          shai_yuval_units_per_package: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sano_price?: number
          sano_sku?: string | null
          sano_units_per_package?: number
          shai_yuval_price?: number
          shai_yuval_sku?: string | null
          shai_yuval_units_per_package?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sano_price?: number
          sano_sku?: string | null
          sano_units_per_package?: number
          shai_yuval_price?: number
          shai_yuval_sku?: string | null
          shai_yuval_units_per_package?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      equipment_order_items: {
        Row: {
          created_at: string | null
          equipment_item_id: string
          id: string
          order_id: string
          quantity: number
          sano_price_at_order: number
          sano_sku_at_order: string | null
          shai_yuval_price_at_order: number
          shai_yuval_sku_at_order: string | null
        }
        Insert: {
          created_at?: string | null
          equipment_item_id: string
          id?: string
          order_id: string
          quantity?: number
          sano_price_at_order: number
          sano_sku_at_order?: string | null
          shai_yuval_price_at_order: number
          shai_yuval_sku_at_order?: string | null
        }
        Update: {
          created_at?: string | null
          equipment_item_id?: string
          id?: string
          order_id?: string
          quantity?: number
          sano_price_at_order?: number
          sano_sku_at_order?: string | null
          shai_yuval_price_at_order?: number
          shai_yuval_sku_at_order?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_order_items_equipment_item_id_fkey"
            columns: ["equipment_item_id"]
            isOneToOne: false
            referencedRelation: "equipment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "equipment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_orders: {
        Row: {
          branch_id: string | null
          branch_name: string | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          notes: string | null
          order_number: string
          rejection_reason: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          branch_name?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          notes?: string | null
          order_number: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string | null
          branch_name?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      external_sync_log: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: string
          rows_synced: number
          started_at: string
          status: string
          table_name: string
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          rows_synced?: number
          started_at?: string
          status: string
          table_name: string
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          rows_synced?: number
          started_at?: string
          status?: string
          table_name?: string
        }
        Relationships: []
      }
      external_sync_state: {
        Row: {
          last_synced_at: string
          table_name: string
          updated_at: string
        }
        Insert: {
          last_synced_at?: string
          table_name: string
          updated_at?: string
        }
        Update: {
          last_synced_at?: string
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      field_tasks: {
        Row: {
          address: string | null
          assigned_by: string
          assigned_to: string
          branch_id: string | null
          client_id: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string | null
          deadline: string | null
          description: string | null
          frequency: string | null
          id: string
          job_type: string
          media_urls: string[] | null
          recurring_parent_id: string | null
          requires_media: boolean | null
          signature_url: string | null
          special_notes: string | null
          special_notes_confirmed: boolean | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          assigned_by: string
          assigned_to: string
          branch_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          job_type: string
          media_urls?: string[] | null
          recurring_parent_id?: string | null
          requires_media?: boolean | null
          signature_url?: string | null
          special_notes?: string | null
          special_notes_confirmed?: boolean | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          assigned_by?: string
          assigned_to?: string
          branch_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          job_type?: string
          media_urls?: string[] | null
          recurring_parent_id?: string | null
          requires_media?: boolean | null
          signature_url?: string | null
          special_notes?: string | null
          special_notes_confirmed?: boolean | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_tasks_recurring_parent_id_fkey"
            columns: ["recurring_parent_id"]
            isOneToOne: false
            referencedRelation: "field_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_alerts: {
        Row: {
          alert_level: number | null
          alert_type: Database["public"]["Enums"]["fleet_alert_type"]
          body: string | null
          created_at: string
          dedup_key: string
          driver_id: string | null
          due_date: string | null
          id: string
          payload: Json | null
          related_id: string | null
          resolved_at: string | null
          sent_at: string | null
          severity: string
          status: Database["public"]["Enums"]["fleet_alert_status"]
          title: string
          vehicle_id: string | null
        }
        Insert: {
          alert_level?: number | null
          alert_type: Database["public"]["Enums"]["fleet_alert_type"]
          body?: string | null
          created_at?: string
          dedup_key: string
          driver_id?: string | null
          due_date?: string | null
          id?: string
          payload?: Json | null
          related_id?: string | null
          resolved_at?: string | null
          sent_at?: string | null
          severity?: string
          status?: Database["public"]["Enums"]["fleet_alert_status"]
          title: string
          vehicle_id?: string | null
        }
        Update: {
          alert_level?: number | null
          alert_type?: Database["public"]["Enums"]["fleet_alert_type"]
          body?: string | null
          created_at?: string
          dedup_key?: string
          driver_id?: string | null
          due_date?: string | null
          id?: string
          payload?: Json | null
          related_id?: string | null
          resolved_at?: string | null
          sent_at?: string | null
          severity?: string
          status?: Database["public"]["Enums"]["fleet_alert_status"]
          title?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_alerts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "fleet_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_alerts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_documents: {
        Row: {
          analysis_notes: string | null
          analysis_status: string
          analyzed_at: string | null
          applied_at: string | null
          created_at: string
          doc_type: string
          driver_id: string | null
          expiry_date: string | null
          extracted_data: Json | null
          file_size: number | null
          file_url: string
          id: string
          notes: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          analysis_notes?: string | null
          analysis_status?: string
          analyzed_at?: string | null
          applied_at?: string | null
          created_at?: string
          doc_type: string
          driver_id?: string | null
          expiry_date?: string | null
          extracted_data?: Json | null
          file_size?: number | null
          file_url: string
          id?: string
          notes?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          analysis_notes?: string | null
          analysis_status?: string
          analyzed_at?: string | null
          applied_at?: string | null
          created_at?: string
          doc_type?: string
          driver_id?: string | null
          expiry_date?: string | null
          extracted_data?: Json | null
          file_size?: number | null
          file_url?: string
          id?: string
          notes?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "fleet_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_driver_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          driver_id: string
          end_date: string | null
          end_km: number | null
          id: string
          notes: string | null
          reason: string | null
          start_date: string
          start_km: number | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          driver_id: string
          end_date?: string | null
          end_km?: number | null
          id?: string
          notes?: string | null
          reason?: string | null
          start_date: string
          start_km?: number | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          driver_id?: string
          end_date?: string | null
          end_km?: number | null
          id?: string
          notes?: string | null
          reason?: string | null
          start_date?: string
          start_km?: number | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_driver_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "fleet_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_driver_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_drivers: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          external_token: string | null
          full_name: string
          id: string
          license_expiry: string | null
          license_number: string | null
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          external_token?: string | null
          full_name: string
          id?: string
          license_expiry?: string | null
          license_number?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          external_token?: string | null
          full_name?: string
          id?: string
          license_expiry?: string | null
          license_number?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      fleet_fines: {
        Row: {
          amount: number
          created_at: string
          document_url: string | null
          driver_id: string | null
          due_date: string | null
          fine_date: string
          id: string
          location: string | null
          notes: string | null
          paid_at: string | null
          reason: string | null
          reference_number: string | null
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          document_url?: string | null
          driver_id?: string | null
          due_date?: string | null
          fine_date: string
          id?: string
          location?: string | null
          notes?: string | null
          paid_at?: string | null
          reason?: string | null
          reference_number?: string | null
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          document_url?: string | null
          driver_id?: string | null
          due_date?: string | null
          fine_date?: string
          id?: string
          location?: string | null
          notes?: string | null
          paid_at?: string | null
          reason?: string | null
          reference_number?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_fines_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "fleet_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_fines_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_incidents: {
        Row: {
          created_at: string
          damage_markers: Json | null
          description: string | null
          driver_id: string | null
          external_reporter_name: string | null
          external_reporter_phone: string | null
          id: string
          incident_date: string
          insurance_claim_number: string | null
          location: string | null
          photos: Json | null
          police_report_number: string | null
          reported_by: string | null
          status: string
          third_party: Json | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          damage_markers?: Json | null
          description?: string | null
          driver_id?: string | null
          external_reporter_name?: string | null
          external_reporter_phone?: string | null
          id?: string
          incident_date: string
          insurance_claim_number?: string | null
          location?: string | null
          photos?: Json | null
          police_report_number?: string | null
          reported_by?: string | null
          status?: string
          third_party?: Json | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          damage_markers?: Json | null
          description?: string | null
          driver_id?: string | null
          external_reporter_name?: string | null
          external_reporter_phone?: string | null
          id?: string
          incident_date?: string
          insurance_claim_number?: string | null
          location?: string | null
          photos?: Json | null
          police_report_number?: string | null
          reported_by?: string | null
          status?: string
          third_party?: Json | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_incidents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "fleet_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_km_monthly: {
        Row: {
          created_at: string
          id: string
          km: number
          month: number
          source: string
          updated_at: string
          vehicle_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          km: number
          month: number
          source?: string
          updated_at?: string
          vehicle_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          km?: number
          month?: number
          source?: string
          updated_at?: string
          vehicle_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fleet_km_monthly_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_km_readings: {
        Row: {
          created_at: string
          driver_id: string | null
          id: string
          notes: string | null
          photo_url: string | null
          reading_date: string
          reading_km: number
          source: Database["public"]["Enums"]["fleet_km_source"]
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          reading_date?: string
          reading_km: number
          source?: Database["public"]["Enums"]["fleet_km_source"]
          vehicle_id: string
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          reading_date?: string
          reading_km?: number
          source?: Database["public"]["Enums"]["fleet_km_source"]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_km_readings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "fleet_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_km_readings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_maintenance: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string | null
          garage: string | null
          id: string
          invoice_url: string | null
          next_due_date: string | null
          next_due_km: number | null
          notes: string | null
          service_date: string
          service_km: number | null
          service_type: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          garage?: string | null
          id?: string
          invoice_url?: string | null
          next_due_date?: string | null
          next_due_km?: number | null
          notes?: string | null
          service_date: string
          service_km?: number | null
          service_type: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          garage?: string | null
          id?: string
          invoice_url?: string | null
          next_due_date?: string | null
          next_due_km?: number | null
          notes?: string | null
          service_date?: string
          service_km?: number | null
          service_type?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_monthly_km_reports: {
        Row: {
          created_at: string
          current_km: number | null
          driver_id: string | null
          id: string
          last_reminder_date: string | null
          month: number
          note: string | null
          odometer_image: string | null
          reminder_count: number
          requested_at: string
          status: string
          submitted_at: string | null
          submitted_by_name: string | null
          token: string
          updated_at: string
          vehicle_id: string
          year: number
        }
        Insert: {
          created_at?: string
          current_km?: number | null
          driver_id?: string | null
          id?: string
          last_reminder_date?: string | null
          month: number
          note?: string | null
          odometer_image?: string | null
          reminder_count?: number
          requested_at?: string
          status?: string
          submitted_at?: string | null
          submitted_by_name?: string | null
          token?: string
          updated_at?: string
          vehicle_id: string
          year: number
        }
        Update: {
          created_at?: string
          current_km?: number | null
          driver_id?: string | null
          id?: string
          last_reminder_date?: string | null
          month?: number
          note?: string | null
          odometer_image?: string | null
          reminder_count?: number
          requested_at?: string
          status?: string
          submitted_at?: string | null
          submitted_by_name?: string | null
          token?: string
          updated_at?: string
          vehicle_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fleet_monthly_km_reports_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "fleet_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_monthly_km_reports_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_n8n_events: {
        Row: {
          action_url: string | null
          created_at: string
          driver_id: string | null
          driver_name: string | null
          driver_phone: string | null
          event_type: string
          id: string
          message: string | null
          payload: Json
          report_id: string | null
          sent_at: string | null
          status: string
          vehicle_id: string | null
          vehicle_label: string | null
          vehicle_plate: string | null
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          driver_id?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          event_type: string
          id?: string
          message?: string | null
          payload?: Json
          report_id?: string | null
          sent_at?: string | null
          status?: string
          vehicle_id?: string | null
          vehicle_label?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          action_url?: string | null
          created_at?: string
          driver_id?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          event_type?: string
          id?: string
          message?: string | null
          payload?: Json
          report_id?: string | null
          sent_at?: string | null
          status?: string
          vehicle_id?: string | null
          vehicle_label?: string | null
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_n8n_events_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "fleet_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_n8n_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "fleet_monthly_km_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_n8n_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_vehicles: {
        Row: {
          annual_km_limit: number | null
          created_at: string
          current_km: number | null
          driver_id: string | null
          id: string
          initial_km: number | null
          insurance_company: string | null
          insurance_expiry_date: string | null
          ituran_code: string | null
          last_maintenance_date: string | null
          last_maintenance_km: number | null
          leasing_company: string | null
          leasing_end_date: string | null
          leasing_months: number | null
          leasing_start_date: string | null
          license_plate: string
          maintenance_interval_km: number | null
          maintenance_interval_months: number | null
          make: string | null
          manager_id: string | null
          model: string | null
          notes: string | null
          ownership_type: Database["public"]["Enums"]["fleet_ownership_type"]
          road_date: string | null
          status: Database["public"]["Enums"]["fleet_vehicle_status"]
          test_expiry_date: string | null
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          annual_km_limit?: number | null
          created_at?: string
          current_km?: number | null
          driver_id?: string | null
          id?: string
          initial_km?: number | null
          insurance_company?: string | null
          insurance_expiry_date?: string | null
          ituran_code?: string | null
          last_maintenance_date?: string | null
          last_maintenance_km?: number | null
          leasing_company?: string | null
          leasing_end_date?: string | null
          leasing_months?: number | null
          leasing_start_date?: string | null
          license_plate: string
          maintenance_interval_km?: number | null
          maintenance_interval_months?: number | null
          make?: string | null
          manager_id?: string | null
          model?: string | null
          notes?: string | null
          ownership_type?: Database["public"]["Enums"]["fleet_ownership_type"]
          road_date?: string | null
          status?: Database["public"]["Enums"]["fleet_vehicle_status"]
          test_expiry_date?: string | null
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          annual_km_limit?: number | null
          created_at?: string
          current_km?: number | null
          driver_id?: string | null
          id?: string
          initial_km?: number | null
          insurance_company?: string | null
          insurance_expiry_date?: string | null
          ituran_code?: string | null
          last_maintenance_date?: string | null
          last_maintenance_km?: number | null
          leasing_company?: string | null
          leasing_end_date?: string | null
          leasing_months?: number | null
          leasing_start_date?: string | null
          license_plate?: string
          maintenance_interval_km?: number | null
          maintenance_interval_months?: number | null
          make?: string | null
          manager_id?: string | null
          model?: string | null
          notes?: string | null
          ownership_type?: Database["public"]["Enums"]["fleet_ownership_type"]
          road_date?: string | null
          status?: Database["public"]["Enums"]["fleet_vehicle_status"]
          test_expiry_date?: string | null
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "fleet_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_catalog_items: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          notes: string | null
          permission: string
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          permission?: string
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          permission?: string
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: []
      }
      logistics_equipment: {
        Row: {
          branch_id: string | null
          branch_name: string | null
          client_charge_amount: number | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          created_by: string
          equipment_cost: number
          equipment_type: string
          equipment_type_other: string | null
          id: string
          is_approved: boolean | null
          is_client_charged: boolean | null
          notes: string | null
          order_date: string
          updated_at: string | null
          vendor_name: string
        }
        Insert: {
          branch_id?: string | null
          branch_name?: string | null
          client_charge_amount?: number | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by: string
          equipment_cost?: number
          equipment_type: string
          equipment_type_other?: string | null
          id?: string
          is_approved?: boolean | null
          is_client_charged?: boolean | null
          notes?: string | null
          order_date: string
          updated_at?: string | null
          vendor_name: string
        }
        Update: {
          branch_id?: string | null
          branch_name?: string | null
          client_charge_amount?: number | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string
          equipment_cost?: number
          equipment_type?: string
          equipment_type_other?: string | null
          id?: string
          is_approved?: boolean | null
          is_client_charged?: boolean | null
          notes?: string | null
          order_date?: string
          updated_at?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_equipment_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_equipment_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_history: {
        Row: {
          created_at: string
          created_by: string | null
          event_date: string
          event_type: string
          from_location: string | null
          id: string
          machine_id: string
          notes: string | null
          to_location: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_date?: string
          event_type: string
          from_location?: string | null
          id?: string
          machine_id: string
          notes?: string | null
          to_location?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_date?: string
          event_type?: string
          from_location?: string | null
          id?: string
          machine_id?: string
          notes?: string | null
          to_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_history_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_repairs: {
        Row: {
          approval_notes: string | null
          cost_excl_vat: number | null
          created_at: string
          created_by: string | null
          description: string | null
          equipment_type: string | null
          id: string
          invoice_number: string | null
          is_approved: string | null
          location_text: string | null
          machine_id: string | null
          machine_number: string | null
          repair_date: string | null
          repair_supplier: string | null
          updated_at: string
        }
        Insert: {
          approval_notes?: string | null
          cost_excl_vat?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment_type?: string | null
          id?: string
          invoice_number?: string | null
          is_approved?: string | null
          location_text?: string | null
          machine_id?: string | null
          machine_number?: string | null
          repair_date?: string | null
          repair_supplier?: string | null
          updated_at?: string
        }
        Update: {
          approval_notes?: string | null
          cost_excl_vat?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment_type?: string | null
          id?: string
          invoice_number?: string | null
          is_approved?: string | null
          location_text?: string | null
          machine_id?: string | null
          machine_number?: string | null
          repair_date?: string | null
          repair_supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_repairs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_service_requests: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          issue_description: string | null
          linked_repair_id: string | null
          location: string | null
          request_date: string
          resolved_at: string | null
          status: string
          supplier_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          issue_description?: string | null
          linked_repair_id?: string | null
          location?: string | null
          request_date?: string
          resolved_at?: string | null
          status?: string
          supplier_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          issue_description?: string | null
          linked_repair_id?: string | null
          location?: string | null
          request_date?: string
          resolved_at?: string | null
          status?: string
          supplier_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_service_requests_linked_repair_id_fkey"
            columns: ["linked_repair_id"]
            isOneToOne: false
            referencedRelation: "machine_repairs"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          created_at: string
          created_by: string | null
          current_location: string | null
          current_status: string
          id: string
          machine_name: string
          monthly_client_charge: number | null
          monthly_rental_cost: number | null
          notes: string | null
          supplier_name: string | null
          supplier_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_location?: string | null
          current_status?: string
          id?: string
          machine_name: string
          monthly_client_charge?: number | null
          monthly_rental_cost?: number | null
          notes?: string | null
          supplier_name?: string | null
          supplier_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_location?: string | null
          current_status?: string
          id?: string
          machine_name?: string
          monthly_client_charge?: number | null
          monthly_rental_cost?: number | null
          notes?: string | null
          supplier_name?: string | null
          supplier_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      management_hours: {
        Row: {
          client_id: string | null
          created_at: string
          hours: number
          id: string
          month: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          hours?: number
          id?: string
          month: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          hours?: number
          id?: string
          month?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_hours_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_tasks: {
        Row: {
          assigned_by: string
          assigned_to: string
          completed_at: string | null
          completion_document_name: string | null
          completion_document_url: string | null
          completion_notes: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          requires_document: boolean | null
          status: string
          task_type: string
          title: string
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          completed_at?: string | null
          completion_document_name?: string | null
          completion_document_url?: string | null
          completion_notes?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          requires_document?: boolean | null
          status?: string
          task_type: string
          title: string
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          completed_at?: string | null
          completion_document_name?: string | null
          completion_document_url?: string | null
          completion_notes?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          requires_document?: boolean | null
          status?: string
          task_type?: string
          title?: string
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manager_tasks_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          route: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          route: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          route?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          device_info: string | null
          id: string
          notification_id: string
          read_at: string | null
          received_at: string | null
          user_id: string
        }
        Insert: {
          device_info?: string | null
          id?: string
          notification_id: string
          read_at?: string | null
          received_at?: string | null
          user_id: string
        }
        Update: {
          device_info?: string | null
          id?: string
          notification_id?: string
          read_at?: string | null
          received_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          created_by: string
          data: Json | null
          id: string
          scheduled_at: string | null
          sent_at: string | null
          target_role: string | null
          target_type: string
          target_user_id: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by: string
          data?: Json | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          target_role?: string | null
          target_type?: string
          target_user_id?: string | null
          title: string
          type?: string
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by?: string
          data?: Json | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          target_role?: string | null
          target_type?: string
          target_user_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      procurement_n8n_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          duration_ms: number | null
          edge_function_invoked: boolean
          error_message: string | null
          error_name: string | null
          failure_stage: string | null
          http_status: number | null
          id: string
          order_id: string | null
          request_completed_at: string | null
          request_started_at: string
          response_body: string | null
          webhook_url: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          duration_ms?: number | null
          edge_function_invoked?: boolean
          error_message?: string | null
          error_name?: string | null
          failure_stage?: string | null
          http_status?: number | null
          id?: string
          order_id?: string | null
          request_completed_at?: string | null
          request_started_at: string
          response_body?: string | null
          webhook_url: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          duration_ms?: number | null
          edge_function_invoked?: boolean
          error_message?: string | null
          error_name?: string | null
          failure_stage?: string | null
          http_status?: number | null
          id?: string
          order_id?: string | null
          request_completed_at?: string | null
          request_started_at?: string
          response_body?: string | null
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_n8n_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "procurement_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_order_activity: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          from_status:
            | Database["public"]["Enums"]["procurement_order_status"]
            | null
          id: string
          order_id: string
          to_status:
            | Database["public"]["Enums"]["procurement_order_status"]
            | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          from_status?:
            | Database["public"]["Enums"]["procurement_order_status"]
            | null
          id?: string
          order_id: string
          to_status?:
            | Database["public"]["Enums"]["procurement_order_status"]
            | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          from_status?:
            | Database["public"]["Enums"]["procurement_order_status"]
            | null
          id?: string
          order_id?: string
          to_status?:
            | Database["public"]["Enums"]["procurement_order_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "procurement_order_activity_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "procurement_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_order_lines: {
        Row: {
          actual_cost: number | null
          added_by_role: string
          added_by_user: string | null
          admin_note: string | null
          chosen_pack_count: number | null
          chosen_supplier_item_id: string | null
          created_at: string
          id: string
          internal_item_id: string
          last_edited_at: string | null
          last_edited_by: string | null
          line_total_snapshot: number | null
          order_id: string
          pack_units: number | null
          quantity: number
          sort_order: number
          split_group: number
          supplier_catalog_item_id: string | null
          supplier_id: string | null
          supplier_item_name: string | null
          supplier_sku: string | null
          surplus_units: number | null
          unit_price_snapshot: number | null
          updated_at: string
          user_note: string | null
        }
        Insert: {
          actual_cost?: number | null
          added_by_role?: string
          added_by_user?: string | null
          admin_note?: string | null
          chosen_pack_count?: number | null
          chosen_supplier_item_id?: string | null
          created_at?: string
          id?: string
          internal_item_id: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          line_total_snapshot?: number | null
          order_id: string
          pack_units?: number | null
          quantity?: number
          sort_order?: number
          split_group?: number
          supplier_catalog_item_id?: string | null
          supplier_id?: string | null
          supplier_item_name?: string | null
          supplier_sku?: string | null
          surplus_units?: number | null
          unit_price_snapshot?: number | null
          updated_at?: string
          user_note?: string | null
        }
        Update: {
          actual_cost?: number | null
          added_by_role?: string
          added_by_user?: string | null
          admin_note?: string | null
          chosen_pack_count?: number | null
          chosen_supplier_item_id?: string | null
          created_at?: string
          id?: string
          internal_item_id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          line_total_snapshot?: number | null
          order_id?: string
          pack_units?: number | null
          quantity?: number
          sort_order?: number
          split_group?: number
          supplier_catalog_item_id?: string | null
          supplier_id?: string | null
          supplier_item_name?: string | null
          supplier_sku?: string | null
          surplus_units?: number | null
          unit_price_snapshot?: number | null
          updated_at?: string
          user_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procurement_order_lines_chosen_supplier_item_id_fkey"
            columns: ["chosen_supplier_item_id"]
            isOneToOne: false
            referencedRelation: "public_price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_order_lines_chosen_supplier_item_id_fkey"
            columns: ["chosen_supplier_item_id"]
            isOneToOne: false
            referencedRelation: "supplier_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_order_lines_internal_item_id_fkey"
            columns: ["internal_item_id"]
            isOneToOne: false
            referencedRelation: "internal_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "procurement_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_order_lines_supplier_catalog_item_id_fkey"
            columns: ["supplier_catalog_item_id"]
            isOneToOne: false
            referencedRelation: "public_price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_order_lines_supplier_catalog_item_id_fkey"
            columns: ["supplier_catalog_item_id"]
            isOneToOne: false
            referencedRelation: "supplier_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_order_lines_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_order_versions: {
        Row: {
          change_summary: Json | null
          created_at: string
          created_by: string | null
          document_type: string
          id: string
          order_id: string
          pdf_filename: string | null
          pdf_url: string | null
          send_error: string | null
          send_status: string
          sent_at: string | null
          sent_by: string | null
          sent_to: Json | null
          snapshot: Json
          version_number: number
        }
        Insert: {
          change_summary?: Json | null
          created_at?: string
          created_by?: string | null
          document_type?: string
          id?: string
          order_id: string
          pdf_filename?: string | null
          pdf_url?: string | null
          send_error?: string | null
          send_status?: string
          sent_at?: string | null
          sent_by?: string | null
          sent_to?: Json | null
          snapshot: Json
          version_number: number
        }
        Update: {
          change_summary?: Json | null
          created_at?: string
          created_by?: string | null
          document_type?: string
          id?: string
          order_id?: string
          pdf_filename?: string | null
          pdf_url?: string | null
          send_error?: string | null
          send_status?: string
          sent_at?: string | null
          sent_by?: string | null
          sent_to?: Json | null
          snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "procurement_order_versions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "procurement_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_orders: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          billing_entity: string
          cancellation_note: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          current_version: number
          delivered_at: string | null
          id: string
          last_edited_after_send_at: string | null
          last_sent_version: number | null
          order_number: string | null
          rejection_reason: string | null
          requested_by: string | null
          sent_to_supplier_at: string | null
          shipping_address_id: string | null
          shipping_notes: string | null
          status: Database["public"]["Enums"]["procurement_order_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          billing_entity?: string
          cancellation_note?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          current_version?: number
          delivered_at?: string | null
          id?: string
          last_edited_after_send_at?: string | null
          last_sent_version?: number | null
          order_number?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          sent_to_supplier_at?: string | null
          shipping_address_id?: string | null
          shipping_notes?: string | null
          status?: Database["public"]["Enums"]["procurement_order_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          billing_entity?: string
          cancellation_note?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          current_version?: number
          delivered_at?: string | null
          id?: string
          last_edited_after_send_at?: string | null
          last_sent_version?: number | null
          order_number?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          sent_to_supplier_at?: string | null
          shipping_address_id?: string | null
          shipping_notes?: string | null
          status?: Database["public"]["Enums"]["procurement_order_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_orders_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "shipping_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          driver_license_expiry: string | null
          driver_license_number: string | null
          email: string | null
          full_name: string
          id: string
          ituran_code: string | null
          phone: string | null
          procurement_enabled: boolean
          procurement_token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          driver_license_expiry?: string | null
          driver_license_number?: string | null
          email?: string | null
          full_name: string
          id?: string
          ituran_code?: string | null
          phone?: string | null
          procurement_enabled?: boolean
          procurement_token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          driver_license_expiry?: string | null
          driver_license_number?: string | null
          email?: string | null
          full_name?: string
          id?: string
          ituran_code?: string | null
          phone?: string | null
          procurement_enabled?: boolean
          procurement_token?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      proposal_client_forms: {
        Row: {
          billing_address: string
          contact_name: string | null
          email: string
          fax: string | null
          form_filler_name: string | null
          form_filler_role: string | null
          full_name: string
          id: string
          id_number: string
          notes: string | null
          office_phone: string | null
          phone: string
          po_box: string | null
          postal_code: string | null
          proposal_id: string
          signature_url: string | null
          submitted_at: string
        }
        Insert: {
          billing_address: string
          contact_name?: string | null
          email: string
          fax?: string | null
          form_filler_name?: string | null
          form_filler_role?: string | null
          full_name: string
          id?: string
          id_number: string
          notes?: string | null
          office_phone?: string | null
          phone: string
          po_box?: string | null
          postal_code?: string | null
          proposal_id: string
          signature_url?: string | null
          submitted_at?: string
        }
        Update: {
          billing_address?: string
          contact_name?: string | null
          email?: string
          fax?: string | null
          form_filler_name?: string | null
          form_filler_role?: string | null
          full_name?: string
          id?: string
          id_number?: string
          notes?: string | null
          office_phone?: string | null
          phone?: string
          po_box?: string | null
          postal_code?: string | null
          proposal_id?: string
          signature_url?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_client_forms_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_services: {
        Row: {
          created_at: string
          frequency: string | null
          id: string
          price: number
          proposal_id: string
          service_description: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          frequency?: string | null
          id?: string
          price: number
          proposal_id: string
          service_description: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          frequency?: string | null
          id?: string
          price?: number
          proposal_id?: string
          service_description?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_services_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          client_name: string
          client_signature_data: Json | null
          client_user_id: string | null
          company_id: string | null
          contact_email: string
          contact_person: string
          created_at: string
          created_by: string
          frequency: string | null
          id: string
          include_client_form: boolean | null
          include_profile: boolean | null
          location: string
          materials: string | null
          notes: string | null
          payment_terms: string | null
          price: number
          proposal_number: string
          service_type: string
          signature_url: string | null
          signed_at: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          client_name: string
          client_signature_data?: Json | null
          client_user_id?: string | null
          company_id?: string | null
          contact_email: string
          contact_person: string
          created_at?: string
          created_by: string
          frequency?: string | null
          id?: string
          include_client_form?: boolean | null
          include_profile?: boolean | null
          location: string
          materials?: string | null
          notes?: string | null
          payment_terms?: string | null
          price: number
          proposal_number: string
          service_type: string
          signature_url?: string | null
          signed_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          client_name?: string
          client_signature_data?: Json | null
          client_user_id?: string | null
          company_id?: string | null
          contact_email?: string
          contact_person?: string
          created_at?: string
          created_by?: string
          frequency?: string | null
          id?: string
          include_client_form?: boolean | null
          include_profile?: boolean | null
          location?: string
          materials?: string | null
          notes?: string | null
          payment_terms?: string | null
          price?: number
          proposal_number?: string
          service_type?: string
          signature_url?: string | null
          signed_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          order_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type: string
          file_url: string
          id?: string
          order_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          order_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_audit_log: {
        Row: {
          action: string
          id: string
          new_values: Json | null
          old_values: Json | null
          order_id: string
          performed_at: string
          performed_by: string
        }
        Insert: {
          action: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          order_id: string
          performed_at?: string
          performed_by: string
        }
        Update: {
          action?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          order_id?: string
          performed_at?: string
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_audit_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string
          delivery_date: string | null
          department: string
          finance_approved_at: string | null
          finance_approved_by: string | null
          id: string
          items: Json
          manager_approved_at: string | null
          manager_approved_by: string | null
          notes: string | null
          order_date: string
          order_number: string
          payment_terms: string | null
          project_site: string | null
          status: string
          subtotal: number
          supplier_contact: string | null
          supplier_name: string
          total_amount: number
          updated_at: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          delivery_date?: string | null
          department: string
          finance_approved_at?: string | null
          finance_approved_by?: string | null
          id?: string
          items?: Json
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          notes?: string | null
          order_date?: string
          order_number: string
          payment_terms?: string | null
          project_site?: string | null
          status?: string
          subtotal?: number
          supplier_contact?: string | null
          supplier_name: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          delivery_date?: string | null
          department?: string
          finance_approved_at?: string | null
          finance_approved_by?: string | null
          id?: string
          items?: Json
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          notes?: string | null
          order_date?: string
          order_number?: string
          payment_terms?: string | null
          project_site?: string | null
          status?: string
          subtotal?: number
          supplier_contact?: string | null
          supplier_name?: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: []
      }
      purchase_requests: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          description: string | null
          id: string
          invoice_number: string | null
          item_name: string
          justification: string
          needed_by_date: string
          po_number: string | null
          quantity: number
          rejection_reason: string | null
          status: string
          total_price: number | null
          unit_price: number | null
          updated_at: string | null
          user_id: string
          vendor_name: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_number?: string | null
          item_name: string
          justification: string
          needed_by_date: string
          po_number?: string | null
          quantity?: number
          rejection_reason?: string | null
          status?: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
          user_id: string
          vendor_name?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_number?: string | null
          item_name?: string
          justification?: string
          needed_by_date?: string
          po_number?: string | null
          quantity?: number
          rejection_reason?: string | null
          status?: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string
          vendor_name?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      request_attachments: {
        Row: {
          created_at: string | null
          file_name: string | null
          file_type: string | null
          file_url: string
          id: string
          request_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          request_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          request_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          assigned_to: string
          completed_at: string | null
          created_at: string | null
          created_by: string
          deadline: string | null
          description: string | null
          id: string
          request_type: string
          response_notes: string | null
          status: Database["public"]["Enums"]["request_status"] | null
          title: string
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          assigned_to: string
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          deadline?: string | null
          description?: string | null
          id?: string
          request_type: string
          response_notes?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          title: string
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          assigned_to?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          deadline?: string | null
          description?: string | null
          id?: string
          request_type?: string
          response_notes?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          title?: string
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: []
      }
      satisfaction_responses: {
        Row: {
          cleanliness_rating: number
          client_user_id: string
          created_at: string
          id: string
          improvement_suggestions: string | null
          manager_service_rating: number
          submitted_at: string
          survey_id: string
          wants_contact: boolean
          workers_punctuality_rating: number
        }
        Insert: {
          cleanliness_rating: number
          client_user_id: string
          created_at?: string
          id?: string
          improvement_suggestions?: string | null
          manager_service_rating: number
          submitted_at?: string
          survey_id: string
          wants_contact?: boolean
          workers_punctuality_rating: number
        }
        Update: {
          cleanliness_rating?: number
          client_user_id?: string
          created_at?: string
          id?: string
          improvement_suggestions?: string | null
          manager_service_rating?: number
          submitted_at?: string
          survey_id?: string
          wants_contact?: boolean
          workers_punctuality_rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "satisfaction_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "satisfaction_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      satisfaction_surveys: {
        Row: {
          client_name: string | null
          client_user_id: string
          completed_at: string | null
          created_at: string
          id: string
          last_reminder_at: string | null
          reminder_count: number
          sent_at: string
          status: string
          survey_period: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          client_user_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          last_reminder_at?: string | null
          reminder_count?: number
          sent_at?: string
          status?: string
          survey_period: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          client_user_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          last_reminder_at?: string | null
          reminder_count?: number
          sent_at?: string
          status?: string
          survey_period?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_logs: {
        Row: {
          created_at: string
          device_info: string | null
          id: string
          ip_address: string | null
          login_at: string
          logout_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: string | null
          login_at?: string
          logout_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: string | null
          login_at?: string
          logout_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shift_assignments: {
        Row: {
          created_at: string | null
          custom_note: string | null
          id: string
          shift_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          custom_note?: string | null
          id?: string
          shift_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          custom_note?: string | null
          id?: string
          shift_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_addresses: {
        Row: {
          active: boolean
          address: string
          client_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          notes: string | null
          site_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address: string
          client_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          site_name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string
          client_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          site_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_addresses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      site_allowed_items: {
        Row: {
          created_at: string
          fixture_type: string | null
          id: string
          internal_item_id: string
          is_blocked: boolean
          is_default_for_category: boolean
          notes: string | null
          shipping_address_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fixture_type?: string | null
          id?: string
          internal_item_id: string
          is_blocked?: boolean
          is_default_for_category?: boolean
          notes?: string | null
          shipping_address_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fixture_type?: string | null
          id?: string
          internal_item_id?: string
          is_blocked?: boolean
          is_default_for_category?: boolean
          notes?: string | null
          shipping_address_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_allowed_items_internal_item_id_fkey"
            columns: ["internal_item_id"]
            isOneToOne: false
            referencedRelation: "internal_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_allowed_items_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "shipping_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_catalog_items: {
        Row: {
          active: boolean
          allow_alternative: boolean
          availability: string | null
          category: string | null
          created_at: string
          id: string
          internal_item_id: string | null
          notes: string | null
          pack_size: number
          purchase_unit: string
          quality: Database["public"]["Enums"]["supplier_item_quality"]
          supplier_id: string
          supplier_product_name: string | null
          supplier_sku: string | null
          unit_price: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          active?: boolean
          allow_alternative?: boolean
          availability?: string | null
          category?: string | null
          created_at?: string
          id?: string
          internal_item_id?: string | null
          notes?: string | null
          pack_size?: number
          purchase_unit?: string
          quality?: Database["public"]["Enums"]["supplier_item_quality"]
          supplier_id: string
          supplier_product_name?: string | null
          supplier_sku?: string | null
          unit_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          active?: boolean
          allow_alternative?: boolean
          availability?: string | null
          category?: string | null
          created_at?: string
          id?: string
          internal_item_id?: string | null
          notes?: string | null
          pack_size?: number
          purchase_unit?: string
          quality?: Database["public"]["Enums"]["supplier_item_quality"]
          supplier_id?: string
          supplier_product_name?: string | null
          supplier_sku?: string | null
          unit_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_catalog_items_internal_item_id_fkey"
            columns: ["internal_item_id"]
            isOneToOne: false
            referencedRelation: "internal_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_catalog_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          contact_name: string | null
          contacts: Json
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          contact_name?: string | null
          contacts?: Json
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          contact_name?: string | null
          contacts?: Json
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      survey_templates: {
        Row: {
          assigned_manager_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          extra_questions: Json
          id: string
          is_active: boolean
          name: string
          question_1: string
          question_2: string
          question_3: string
          question_4: string
          question_5: string
          show_branch_field: boolean
          show_manager_field: boolean
          show_role_field: boolean
          updated_at: string
        }
        Insert: {
          assigned_manager_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          extra_questions?: Json
          id?: string
          is_active?: boolean
          name: string
          question_1?: string
          question_2?: string
          question_3?: string
          question_4?: string
          question_5?: string
          show_branch_field?: boolean
          show_manager_field?: boolean
          show_role_field?: boolean
          updated_at?: string
        }
        Update: {
          assigned_manager_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          extra_questions?: Json
          id?: string
          is_active?: boolean
          name?: string
          question_1?: string
          question_2?: string
          question_3?: string
          question_4?: string
          question_5?: string
          show_branch_field?: boolean
          show_manager_field?: boolean
          show_role_field?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          id: string
          manager_id: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          manager_id?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_module_permissions: {
        Row: {
          created_at: string | null
          data_scope: Database["public"]["Enums"]["data_scope"] | null
          has_access: boolean | null
          id: string
          module_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_scope?: Database["public"]["Enums"]["data_scope"] | null
          has_access?: boolean | null
          id?: string
          module_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_scope?: Database["public"]["Enums"]["data_scope"] | null
          has_access?: boolean | null
          id?: string
          module_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_module_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_views: {
        Row: {
          created_at: string
          id: string
          last_viewed_at: string
          module_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_viewed_at?: string
          module_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_viewed_at?: string
          module_name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_shifts: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          shift_date: string
          shift_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          shift_date: string
          shift_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          shift_date?: string
          shift_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      public_price_list: {
        Row: {
          id: string | null
          notes: string | null
          pack_size: number | null
          purchase_unit: string | null
          supplier_id: string | null
          supplier_name: string | null
          supplier_product_name: string | null
          supplier_sku: string | null
          unit_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_catalog_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      public_survey_templates: {
        Row: {
          description: string | null
          extra_questions: Json | null
          id: string | null
          is_active: boolean | null
          name: string | null
          question_1: string | null
          question_2: string | null
          question_3: string | null
          question_4: string | null
          question_5: string | null
          show_branch_field: boolean | null
          show_manager_field: boolean | null
          show_role_field: boolean | null
        }
        Insert: {
          description?: string | null
          extra_questions?: Json | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          question_1?: string | null
          question_2?: string | null
          question_3?: string | null
          question_4?: string | null
          question_5?: string | null
          show_branch_field?: boolean | null
          show_manager_field?: boolean | null
          show_role_field?: boolean | null
        }
        Update: {
          description?: string | null
          extra_questions?: Json | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          question_1?: string | null
          question_2?: string | null
          question_3?: string | null
          question_4?: string | null
          question_5?: string | null
          show_branch_field?: boolean | null
          show_manager_field?: boolean | null
          show_role_field?: boolean | null
        }
        Relationships: []
      }
      purchase_requests_employee: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          item_name: string | null
          justification: string | null
          needed_by_date: string | null
          quantity: number | null
          rejection_reason: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          item_name?: string | null
          justification?: string | null
          needed_by_date?: string | null
          quantity?: number | null
          rejection_reason?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          item_name?: string | null
          justification?: string | null
          needed_by_date?: string | null
          quantity?: number | null
          rejection_reason?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_proposal: { Args: { _proposal_id: string }; Returns: boolean }
      can_manage_vehicle: { Args: { _vehicle_id: string }; Returns: boolean }
      fleet_driver_at_date: {
        Args: { _date: string; _vehicle_id: string }
        Returns: string
      }
      generate_equipment_order_number: { Args: never; Returns: string }
      generate_po_number: { Args: never; Returns: string }
      generate_proposal_number: { Args: never; Returns: string }
      get_customer_complaint_count: {
        Args: { months_back?: number; phone: string }
        Returns: number
      }
      get_manager_complaint_count: {
        Args: { days_back?: number; mgr_id: string }
        Returns: number
      }
      get_team_member_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_data_scope: {
        Args: { _module_name: string; _user_id: string }
        Returns: Database["public"]["Enums"]["data_scope"]
      }
      has_module_access: {
        Args: { _module_name: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_client: { Args: { _user_id: string }; Returns: boolean }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "manager" | "driver" | "client"
      damage_severity: "minor" | "moderate" | "severe"
      damage_type: "scratch" | "dent" | "crack" | "other"
      data_scope: "personal" | "team" | "global"
      fleet_alert_status: "pending" | "sent" | "dismissed" | "resolved"
      fleet_alert_type:
        | "test_expiry"
        | "insurance_expiry"
        | "maintenance_due"
        | "fine"
        | "km_overuse"
        | "license_expiry"
      fleet_km_source: "external_form" | "manual" | "import"
      fleet_ownership_type: "company" | "leasing" | "private"
      fleet_vehicle_status:
        | "active"
        | "in_service"
        | "inactive"
        | "sold"
        | "totaled"
      procurement_order_status:
        | "draft"
        | "pending_approval"
        | "in_review"
        | "returned_for_fix"
        | "rejected"
        | "approved"
        | "sent_to_supplier"
        | "delivered"
        | "cancelled"
        | "edited_after_send"
        | "pending_update_send"
        | "update_sent"
        | "cancellation_pending_send"
        | "send_failed"
      request_status: "pending" | "in_progress" | "completed" | "cancelled"
      supplier_item_quality: "basic" | "standard" | "premium"
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
    Enums: {
      app_role: ["super_admin", "manager", "driver", "client"],
      damage_severity: ["minor", "moderate", "severe"],
      damage_type: ["scratch", "dent", "crack", "other"],
      data_scope: ["personal", "team", "global"],
      fleet_alert_status: ["pending", "sent", "dismissed", "resolved"],
      fleet_alert_type: [
        "test_expiry",
        "insurance_expiry",
        "maintenance_due",
        "fine",
        "km_overuse",
        "license_expiry",
      ],
      fleet_km_source: ["external_form", "manual", "import"],
      fleet_ownership_type: ["company", "leasing", "private"],
      fleet_vehicle_status: [
        "active",
        "in_service",
        "inactive",
        "sold",
        "totaled",
      ],
      procurement_order_status: [
        "draft",
        "pending_approval",
        "in_review",
        "returned_for_fix",
        "rejected",
        "approved",
        "sent_to_supplier",
        "delivered",
        "cancelled",
        "edited_after_send",
        "pending_update_send",
        "update_sent",
        "cancellation_pending_send",
        "send_failed",
      ],
      request_status: ["pending", "in_progress", "completed", "cancelled"],
      supplier_item_quality: ["basic", "standard", "premium"],
    },
  },
} as const
