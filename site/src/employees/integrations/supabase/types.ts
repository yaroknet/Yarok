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
      branches: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          network_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          network_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          network_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_workers: {
        Row: {
          contractor_id: string
          created_at: string
          id: string
          worker_id: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          id?: string
          worker_id: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          id?: string
          worker_id?: string
        }
        Relationships: []
      }
      custom_reminders: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          link_url: string | null
          message_body: string
          month_days: number[] | null
          name: string
          pre_saturday_friday: boolean
          pre_saturday_time: string | null
          recipient_name: string
          recipient_phone: string
          reminder_key: string
          schedule_time: string
          schedule_type: string
          updated_at: string
          weekday: number | null
          weekday_occurrence: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          message_body: string
          month_days?: number[] | null
          name: string
          pre_saturday_friday?: boolean
          pre_saturday_time?: string | null
          recipient_name: string
          recipient_phone: string
          reminder_key: string
          schedule_time?: string
          schedule_type?: string
          updated_at?: string
          weekday?: number | null
          weekday_occurrence?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          message_body?: string
          month_days?: number[] | null
          name?: string
          pre_saturday_friday?: boolean
          pre_saturday_time?: string | null
          recipient_name?: string
          recipient_phone?: string
          reminder_key?: string
          schedule_time?: string
          schedule_type?: string
          updated_at?: string
          weekday?: number | null
          weekday_occurrence?: number | null
        }
        Relationships: []
      }
      customer_network_access: {
        Row: {
          created_at: string
          id: string
          network_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          network_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          network_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_network_access_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      field_reports: {
        Row: {
          created_at: string
          gps_lat: number | null
          gps_lng: number | null
          id: string
          notes: string | null
          reported_by: string
          sides_completed: number
          signature_url: string | null
          submitted_at: string
          task_id: string
        }
        Insert: {
          created_at?: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          notes?: string | null
          reported_by: string
          sides_completed: number
          signature_url?: string | null
          submitted_at?: string
          task_id: string
        }
        Update: {
          created_at?: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          notes?: string | null
          reported_by?: string
          sides_completed?: number
          signature_url?: string | null
          submitted_at?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_reports_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_archived: boolean
          is_read: boolean
          media_url: string | null
          recipient_id: string
          sender_id: string
          subject: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_read?: boolean
          media_url?: string | null
          recipient_id: string
          sender_id: string
          subject?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_read?: boolean
          media_url?: string | null
          recipient_id?: string
          sender_id?: string
          subject?: string | null
        }
        Relationships: []
      }
      network_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          network_id: string
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          network_id: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          network_id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_contacts_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      networks: {
        Row: {
          billing_address: string | null
          billing_email: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_new_client: boolean
          name: string
          office_phone: string | null
          report_email: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          billing_address?: string | null
          billing_email?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_new_client?: boolean
          name: string
          office_phone?: string | null
          report_email?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          billing_address?: string | null
          billing_email?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_new_client?: boolean
          name?: string
          office_phone?: string | null
          report_email?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      personal_tasks: {
        Row: {
          assigned_to: string
          color: string | null
          created_at: string
          created_by: string
          done_at: string | null
          id: string
          is_done: boolean
          is_important: boolean
          is_recurring: boolean
          last_recurrence_created: string | null
          last_reminder_sent: string | null
          notes: string | null
          recurrence_day: number | null
          reminder_frequency: string | null
          status: string
          title: string
          updated_at: string
          urgency: string
        }
        Insert: {
          assigned_to: string
          color?: string | null
          created_at?: string
          created_by: string
          done_at?: string | null
          id?: string
          is_done?: boolean
          is_important?: boolean
          is_recurring?: boolean
          last_recurrence_created?: string | null
          last_reminder_sent?: string | null
          notes?: string | null
          recurrence_day?: number | null
          reminder_frequency?: string | null
          status?: string
          title: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          assigned_to?: string
          color?: string | null
          created_at?: string
          created_by?: string
          done_at?: string | null
          id?: string
          is_done?: boolean
          is_important?: boolean
          is_recurring?: boolean
          last_recurrence_created?: string | null
          last_reminder_sent?: string | null
          notes?: string | null
          recurrence_day?: number | null
          reminder_frequency?: string | null
          status?: string
          title?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: []
      }
      price_list: {
        Row: {
          base_price: number
          comments: string | null
          created_at: string
          id: string
          is_active: boolean
          network_name: string
          service_type: string
          sort_order: number
          travel_label: string | null
          travel_price: number | null
          updated_at: string
        }
        Insert: {
          base_price?: number
          comments?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          network_name: string
          service_type: string
          sort_order?: number
          travel_label?: string | null
          travel_price?: number | null
          updated_at?: string
        }
        Update: {
          base_price?: number
          comments?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          network_name?: string
          service_type?: string
          sort_order?: number
          travel_label?: string | null
          travel_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          description: string
          frequency: string | null
          id: string
          price: number
          quantity: number
          quote_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description: string
          frequency?: string | null
          id?: string
          price?: number
          quantity?: number
          quote_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          frequency?: string | null
          id?: string
          price?: number
          quantity?: number
          quote_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_view_log: {
        Row: {
          id: string
          ip_address: string | null
          quote_id: string
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          quote_id: string
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          quote_id?: string
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_view_log_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          branch_name: string | null
          client_details_filled_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          filled_billing_address: string | null
          filled_contact_person: string | null
          filled_email: string | null
          filled_office_phone: string | null
          filled_vat_number: string | null
          first_viewed_at: string | null
          id: string
          last_viewed_at: string | null
          materials: string[] | null
          materials_other_text: string | null
          network_id: string | null
          network_name_snapshot: string
          notes: string | null
          notification_email: string | null
          payment_terms: string
          quote_number: number
          requires_client_details: boolean
          sent_at: string | null
          signature_data: string | null
          signed_at: string | null
          signed_pdf_url: string | null
          signer_id_number: string | null
          signer_name: string | null
          status: string
          total_amount: number | null
          unique_token: string
          updated_at: string
          view_count: number
        }
        Insert: {
          branch_name?: string | null
          client_details_filled_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          filled_billing_address?: string | null
          filled_contact_person?: string | null
          filled_email?: string | null
          filled_office_phone?: string | null
          filled_vat_number?: string | null
          first_viewed_at?: string | null
          id?: string
          last_viewed_at?: string | null
          materials?: string[] | null
          materials_other_text?: string | null
          network_id?: string | null
          network_name_snapshot: string
          notes?: string | null
          notification_email?: string | null
          payment_terms?: string
          quote_number?: number
          requires_client_details?: boolean
          sent_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_pdf_url?: string | null
          signer_id_number?: string | null
          signer_name?: string | null
          status?: string
          total_amount?: number | null
          unique_token?: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          branch_name?: string | null
          client_details_filled_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          filled_billing_address?: string | null
          filled_contact_person?: string | null
          filled_email?: string | null
          filled_office_phone?: string | null
          filled_vat_number?: string | null
          first_viewed_at?: string | null
          id?: string
          last_viewed_at?: string | null
          materials?: string[] | null
          materials_other_text?: string | null
          network_id?: string | null
          network_name_snapshot?: string
          notes?: string | null
          notification_email?: string | null
          payment_terms?: string
          quote_number?: number
          requires_client_details?: boolean
          sent_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_pdf_url?: string | null
          signer_id_number?: string | null
          signer_name?: string | null
          status?: string
          total_amount?: number | null
          unique_token?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      report_media: {
        Row: {
          created_at: string
          field_report_id: string
          file_type: string
          file_url: string
          id: string
        }
        Insert: {
          created_at?: string
          field_report_id: string
          file_type: string
          file_url: string
          id?: string
        }
        Update: {
          created_at?: string
          field_report_id?: string
          file_type?: string
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_media_field_report_id_fkey"
            columns: ["field_report_id"]
            isOneToOne: false
            referencedRelation: "field_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      service_start_proofs: {
        Row: {
          barcode_photo_url: string
          created_at: string
          extra_photos: string[] | null
          extra_videos: string[] | null
          id: string
          notes: string | null
          service_id: string
          submitted_by: string
          triangle_photo_url: string
          work_start_date: string
        }
        Insert: {
          barcode_photo_url: string
          created_at?: string
          extra_photos?: string[] | null
          extra_videos?: string[] | null
          id?: string
          notes?: string | null
          service_id: string
          submitted_by: string
          triangle_photo_url: string
          work_start_date: string
        }
        Update: {
          barcode_photo_url?: string
          created_at?: string
          extra_photos?: string[] | null
          extra_videos?: string[] | null
          id?: string
          notes?: string | null
          service_id?: string
          submitted_by?: string
          triangle_photo_url?: string
          work_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_start_proofs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          action_type: string
          assigned_to: string | null
          branch_name: string
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          date_option: string | null
          days_per_week: number
          has_billing_notification: boolean
          has_client_details: boolean
          has_signed_agreement: boolean
          hours_per_visit: number
          id: string
          logistics: string[] | null
          manager_id: string | null
          network_name: string
          notes: string | null
          specific_date: string | null
          status: string
          stop_hila_notified: boolean
          stop_rotem_notified: boolean
          updated_at: string
          weekly_total: number | null
        }
        Insert: {
          action_type?: string
          assigned_to?: string | null
          branch_name: string
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          date_option?: string | null
          days_per_week?: number
          has_billing_notification?: boolean
          has_client_details?: boolean
          has_signed_agreement?: boolean
          hours_per_visit?: number
          id?: string
          logistics?: string[] | null
          manager_id?: string | null
          network_name: string
          notes?: string | null
          specific_date?: string | null
          status?: string
          stop_hila_notified?: boolean
          stop_rotem_notified?: boolean
          updated_at?: string
          weekly_total?: number | null
        }
        Update: {
          action_type?: string
          assigned_to?: string | null
          branch_name?: string
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          date_option?: string | null
          days_per_week?: number
          has_billing_notification?: boolean
          has_client_details?: boolean
          has_signed_agreement?: boolean
          hours_per_visit?: number
          id?: string
          logistics?: string[] | null
          manager_id?: string | null
          network_name?: string
          notes?: string | null
          specific_date?: string | null
          status?: string
          stop_hila_notified?: boolean
          stop_rotem_notified?: boolean
          updated_at?: string
          weekly_total?: number | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          branch_id: string
          created_at: string
          due_date: string | null
          end_date: string | null
          executor: string | null
          frequency: string
          id: string
          is_recurring: boolean
          parent_task_id: string | null
          requires_photo: boolean
          requires_video: boolean
          sent_to_client_at: string | null
          sent_to_email: string | null
          sides_required: number
          specific_dates: string[] | null
          start_date: string | null
          status: string
          total_client_price: number | null
          total_contractor_price: number | null
          updated_at: string
          whatsapp_message: string | null
          work_type: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          branch_id: string
          created_at?: string
          due_date?: string | null
          end_date?: string | null
          executor?: string | null
          frequency?: string
          id?: string
          is_recurring?: boolean
          parent_task_id?: string | null
          requires_photo?: boolean
          requires_video?: boolean
          sent_to_client_at?: string | null
          sent_to_email?: string | null
          sides_required?: number
          specific_dates?: string[] | null
          start_date?: string | null
          status?: string
          total_client_price?: number | null
          total_contractor_price?: number | null
          updated_at?: string
          whatsapp_message?: string | null
          work_type: string
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          branch_id?: string
          created_at?: string
          due_date?: string | null
          end_date?: string | null
          executor?: string | null
          frequency?: string
          id?: string
          is_recurring?: boolean
          parent_task_id?: string | null
          requires_photo?: boolean
          requires_video?: boolean
          sent_to_client_at?: string | null
          sent_to_email?: string | null
          sides_required?: number
          specific_dates?: string[] | null
          start_date?: string | null
          status?: string
          total_client_price?: number | null
          total_contractor_price?: number | null
          updated_at?: string
          whatsapp_message?: string | null
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      team_tasks: {
        Row: {
          created_at: string
          created_by: string
          creator_role: string
          employee_name: string
          employee_phone: string | null
          id: string
          last_reminder_sent: string | null
          reminder_frequency: string | null
          status: string
          task_description: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          creator_role?: string
          employee_name: string
          employee_phone?: string | null
          id?: string
          last_reminder_sent?: string | null
          reminder_frequency?: string | null
          status?: string
          task_description: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          creator_role?: string
          employee_name?: string
          employee_phone?: string | null
          id?: string
          last_reminder_sent?: string | null
          reminder_frequency?: string | null
          status?: string
          task_description?: string
          updated_at?: string
        }
        Relationships: []
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
      whatsapp_backlog: {
        Row: {
          done: boolean
          id: string
          note: string
          updated_at: string
        }
        Insert: {
          done?: boolean
          id: string
          note?: string
          updated_at?: string
        }
        Update: {
          done?: boolean
          id?: string
          note?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_log: {
        Row: {
          id: string
          message_body: string
          message_type: string
          recipient_name: string | null
          recipient_phone: string | null
          sent_at: string
          service_id: string | null
          task_id: string | null
          webhook_status: number | null
        }
        Insert: {
          id?: string
          message_body: string
          message_type: string
          recipient_name?: string | null
          recipient_phone?: string | null
          sent_at?: string
          service_id?: string | null
          task_id?: string | null
          webhook_status?: number | null
        }
        Update: {
          id?: string
          message_body?: string
          message_type?: string
          recipient_name?: string | null
          recipient_phone?: string | null
          sent_at?: string
          service_id?: string | null
          task_id?: string | null
          webhook_status?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_log_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_schedule_config: {
        Row: {
          created_at: string
          description: string | null
          exclude_names: string[] | null
          filter_roles: string[] | null
          filter_work_types: string[] | null
          id: string
          include_user_ids: string[] | null
          is_active: boolean
          name: string
          recipient_name: string
          recipient_phone: string
          schedule_day: number | null
          schedule_days: number[] | null
          schedule_time: string
          schedule_type: string
          summary_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          exclude_names?: string[] | null
          filter_roles?: string[] | null
          filter_work_types?: string[] | null
          id?: string
          include_user_ids?: string[] | null
          is_active?: boolean
          name: string
          recipient_name: string
          recipient_phone: string
          schedule_day?: number | null
          schedule_days?: number[] | null
          schedule_time?: string
          schedule_type?: string
          summary_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          exclude_names?: string[] | null
          filter_roles?: string[] | null
          filter_work_types?: string[] | null
          id?: string
          include_user_ids?: string[] | null
          is_active?: boolean
          name?: string
          recipient_name?: string
          recipient_phone?: string
          schedule_day?: number | null
          schedule_days?: number[] | null
          schedule_time?: string
          schedule_type?: string
          summary_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          template_key: string
          template_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          template_key: string
          template_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          template_key?: string
          template_text?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "office_manager"
        | "team_leader"
        | "customer"
        | "contractor"
        | "contractor_worker"
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
      app_role: [
        "super_admin",
        "office_manager",
        "team_leader",
        "customer",
        "contractor",
        "contractor_worker",
      ],
    },
  },
} as const
