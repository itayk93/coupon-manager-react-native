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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_messages: {
        Row: {
          created_at: string
          id: number
          link_text: string | null
          link_url: string | null
          message_text: string
        }
        Insert: {
          created_at?: string
          id?: number
          link_text?: string | null
          link_url?: string | null
          message_text: string
        }
        Update: {
          created_at?: string
          id?: number
          link_text?: string | null
          link_url?: string | null
          message_text?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          setting_key: string
          setting_type: string
          setting_value: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          setting_key: string
          setting_type: string
          setting_value?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          setting_key?: string
          setting_type?: string
          setting_value?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      alembic_version: {
        Row: {
          version_num: string
        }
        Insert: {
          version_num: string
        }
        Update: {
          version_num?: string
        }
        Relationships: []
      }
      auto_update_runs: {
        Row: {
          failed_count: number
          finished_at: string | null
          id: number
          job_id: string | null
          message: string | null
          run_type: string
          skipped_count: number
          started_at: string | null
          status: string
          triggered_by_user_id: number | null
          updated_count: number
          user_id: number | null
        }
        Insert: {
          failed_count?: number
          finished_at?: string | null
          id?: number
          job_id?: string | null
          message?: string | null
          run_type?: string
          skipped_count?: number
          started_at?: string | null
          status?: string
          triggered_by_user_id?: number | null
          updated_count?: number
          user_id?: number | null
        }
        Update: {
          failed_count?: number
          finished_at?: string | null
          id?: number
          job_id?: string | null
          message?: string | null
          run_type?: string
          skipped_count?: number
          started_at?: string | null
          status?: string
          triggered_by_user_id?: number | null
          updated_count?: number
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_update_runs_triggered_by_user_id_fkey"
            columns: ["triggered_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          company_count: number | null
          id: number
          image_path: string | null
          name: string
        }
        Insert: {
          company_count?: number | null
          id?: number
          image_path?: string | null
          name: string
        }
        Update: {
          company_count?: number | null
          id?: number
          image_path?: string | null
          name?: string
        }
        Relationships: []
      }
      coupon: {
        Row: {
          auto_download_details: string | null
          auto_update: boolean
          buyme_coupon_url: string | null
          card_exp: string | null
          code: string
          company: string
          company_id: number | null
          cost: number
          cvv: string | null
          date_added: string | null
          description: string | null
          discount_percentage: number | null
          expiration: string | null
          id: number
          is_available: boolean | null
          is_for_sale: boolean | null
          is_one_time: boolean | null
          last_code_view: string | null
          last_company_view: string | null
          last_detail_view: string | null
          last_scraped: string | null
          purpose: string | null
          reminder_sent_1_day: boolean
          reminder_sent_30_days: boolean
          reminder_sent_7_days: boolean
          reminder_sent_today: boolean | null
          show_in_widget: boolean | null
          source: string | null
          special_message: string | null
          status: string
          strauss_coupon_url: string | null
          used_value: number
          user_id: number | null
          value: number
          widget_display_order: number | null
          xgiftcard_coupon_url: string | null
          xtra_coupon_url: string | null
        }
        Insert: {
          auto_download_details?: string | null
          auto_update?: boolean
          buyme_coupon_url?: string | null
          card_exp?: string | null
          code: string
          company: string
          company_id?: number | null
          cost: number
          cvv?: string | null
          date_added?: string | null
          description?: string | null
          discount_percentage?: number | null
          expiration?: string | null
          id?: number
          is_available?: boolean | null
          is_for_sale?: boolean | null
          is_one_time?: boolean | null
          last_code_view?: string | null
          last_company_view?: string | null
          last_detail_view?: string | null
          last_scraped?: string | null
          purpose?: string | null
          reminder_sent_1_day?: boolean
          reminder_sent_30_days?: boolean
          reminder_sent_7_days?: boolean
          reminder_sent_today?: boolean | null
          show_in_widget?: boolean | null
          source?: string | null
          special_message?: string | null
          status: string
          strauss_coupon_url?: string | null
          used_value: number
          user_id?: number | null
          value: number
          widget_display_order?: number | null
          xgiftcard_coupon_url?: string | null
          xtra_coupon_url?: string | null
        }
        Update: {
          auto_download_details?: string | null
          auto_update?: boolean
          buyme_coupon_url?: string | null
          card_exp?: string | null
          code?: string
          company?: string
          company_id?: number | null
          cost?: number
          cvv?: string | null
          date_added?: string | null
          description?: string | null
          discount_percentage?: number | null
          expiration?: string | null
          id?: number
          is_available?: boolean | null
          is_for_sale?: boolean | null
          is_one_time?: boolean | null
          last_code_view?: string | null
          last_company_view?: string | null
          last_detail_view?: string | null
          last_scraped?: string | null
          purpose?: string | null
          reminder_sent_1_day?: boolean
          reminder_sent_30_days?: boolean
          reminder_sent_7_days?: boolean
          reminder_sent_today?: boolean | null
          show_in_widget?: boolean | null
          source?: string | null
          special_message?: string | null
          status?: string
          strauss_coupon_url?: string | null
          used_value?: number
          user_id?: number | null
          value?: number
          widget_display_order?: number | null
          xgiftcard_coupon_url?: string | null
          xtra_coupon_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_active_viewers: {
        Row: {
          coupon_id: number
          id: number
          last_activity: string | null
          session_id: string
          user_id: number
        }
        Insert: {
          coupon_id: number
          id?: number
          last_activity?: string | null
          session_id: string
          user_id: number
        }
        Update: {
          coupon_id?: number
          id?: number
          last_activity?: string | null
          session_id?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupon_active_viewers_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupon"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_active_viewers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_shares: {
        Row: {
          accepted_at: string | null
          coupon_id: number
          created_at: string | null
          id: number
          revocation_requested_at: string | null
          revocation_requested_by: number | null
          revocation_token: string | null
          revocation_token_expires_at: string | null
          revoked_at: string | null
          share_expires_at: string
          share_token: string
          shared_by_user_id: number
          shared_with_user_id: number | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          coupon_id: number
          created_at?: string | null
          id?: number
          revocation_requested_at?: string | null
          revocation_requested_by?: number | null
          revocation_token?: string | null
          revocation_token_expires_at?: string | null
          revoked_at?: string | null
          share_expires_at: string
          share_token: string
          shared_by_user_id: number
          shared_with_user_id?: number | null
          status: string
        }
        Update: {
          accepted_at?: string | null
          coupon_id?: number
          created_at?: string | null
          id?: number
          revocation_requested_at?: string | null
          revocation_requested_by?: number | null
          revocation_token?: string | null
          revocation_token_expires_at?: string | null
          revoked_at?: string | null
          share_expires_at?: string
          share_token?: string
          shared_by_user_id?: number
          shared_with_user_id?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_shares_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupon"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_shares_revocation_requested_by_fkey"
            columns: ["revocation_requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_shares_shared_by_user_id_fkey"
            columns: ["shared_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_shares_shared_with_user_id_fkey"
            columns: ["shared_with_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_tags: {
        Row: {
          coupon_id: number
          tag_id: number
        }
        Insert: {
          coupon_id: number
          tag_id: number
        }
        Update: {
          coupon_id?: number
          tag_id?: number
        }
        Relationships: []
      }
      coupon_transaction: {
        Row: {
          coupon_id: number
          id: number
          location: string | null
          recharge_amount: number | null
          reference_number: string | null
          source: string
          transaction_date: string | null
          usage_amount: number | null
        }
        Insert: {
          coupon_id: number
          id?: number
          location?: string | null
          recharge_amount?: number | null
          reference_number?: string | null
          source?: string
          transaction_date?: string | null
          usage_amount?: number | null
        }
        Update: {
          coupon_id?: number
          id?: number
          location?: string | null
          recharge_amount?: number | null
          reference_number?: string | null
          source?: string
          transaction_date?: string | null
          usage_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_transaction_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupon"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usage: {
        Row: {
          action: string | null
          coupon_id: number
          details: string | null
          id: number
          timestamp: string | null
          used_amount: number
        }
        Insert: {
          action?: string | null
          coupon_id: number
          details?: string | null
          id?: number
          timestamp?: string | null
          used_amount: number
        }
        Update: {
          action?: string | null
          coupon_id?: number
          details?: string | null
          id?: number
          timestamp?: string | null
          used_amount?: number
        }
        Relationships: []
      }
      daily_email_status: {
        Row: {
          date: string
          id: number
          process: string
          was_sent: boolean | null
        }
        Insert: {
          date: string
          id?: number
          process?: string
          was_sent?: boolean | null
        }
        Update: {
          date?: string
          id?: number
          process?: string
          was_sent?: boolean | null
        }
        Relationships: []
      }
      feature_access: {
        Row: {
          access_mode: string | null
          feature_name: string
          id: number
        }
        Insert: {
          access_mode?: string | null
          feature_name: string
          id?: never
        }
        Update: {
          access_mode?: string | null
          feature_name?: string
          id?: never
        }
        Relationships: []
      }
      gpt_usage: {
        Row: {
          completion_tokens: number | null
          cost_ils: number | null
          cost_usd: number | null
          created: string | null
          exchange_rate: number | null
          gpt_usage_id: number
          id: string | null
          model: string | null
          object: string | null
          prompt_text: string | null
          prompt_tokens: number | null
          response_text: string | null
          total_tokens: number | null
          user_id: number
        }
        Insert: {
          completion_tokens?: number | null
          cost_ils?: number | null
          cost_usd?: number | null
          created?: string | null
          exchange_rate?: number | null
          gpt_usage_id?: number
          id?: string | null
          model?: string | null
          object?: string | null
          prompt_text?: string | null
          prompt_tokens?: number | null
          response_text?: string | null
          total_tokens?: number | null
          user_id: number
        }
        Update: {
          completion_tokens?: number | null
          cost_ils?: number | null
          cost_usd?: number | null
          created?: string | null
          exchange_rate?: number | null
          gpt_usage_id?: number
          id?: string | null
          model?: string | null
          object?: string | null
          prompt_text?: string | null
          prompt_tokens?: number | null
          response_text?: string | null
          total_tokens?: number | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "gpt_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_sendings: {
        Row: {
          delivery_status: string | null
          error_message: string | null
          id: number
          newsletter_id: number
          sent_at: string | null
          user_id: number
        }
        Insert: {
          delivery_status?: string | null
          error_message?: string | null
          id?: number
          newsletter_id: number
          sent_at?: string | null
          user_id: number
        }
        Update: {
          delivery_status?: string | null
          error_message?: string | null
          id?: number
          newsletter_id?: number
          sent_at?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_sendings_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_sendings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletters: {
        Row: {
          additional_title: string | null
          content: string | null
          created_at: string | null
          created_by: number
          custom_html: string | null
          footer_message: string | null
          greeting_content: string | null
          greeting_title: string | null
          highlight_icon: string | null
          highlight_text: string | null
          id: number
          image_path: string | null
          is_published: boolean | null
          is_sent: boolean | null
          main_title: string | null
          newsletter_type: string | null
          scheduled_send_time: string | null
          sent_count: number | null
          show_telegram_button: boolean | null
          telegram_bot_section: string | null
          title: string
          website_features_section: string | null
        }
        Insert: {
          additional_title?: string | null
          content?: string | null
          created_at?: string | null
          created_by: number
          custom_html?: string | null
          footer_message?: string | null
          greeting_content?: string | null
          greeting_title?: string | null
          highlight_icon?: string | null
          highlight_text?: string | null
          id?: number
          image_path?: string | null
          is_published?: boolean | null
          is_sent?: boolean | null
          main_title?: string | null
          newsletter_type?: string | null
          scheduled_send_time?: string | null
          sent_count?: number | null
          show_telegram_button?: boolean | null
          telegram_bot_section?: string | null
          title: string
          website_features_section?: string | null
        }
        Update: {
          additional_title?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: number
          custom_html?: string | null
          footer_message?: string | null
          greeting_content?: string | null
          greeting_title?: string | null
          highlight_icon?: string | null
          highlight_text?: string | null
          id?: number
          image_path?: string | null
          is_published?: boolean | null
          is_sent?: boolean | null
          main_title?: string | null
          newsletter_type?: string | null
          scheduled_send_time?: string | null
          sent_count?: number | null
          show_telegram_button?: boolean | null
          telegram_bot_section?: string | null
          title?: string
          website_features_section?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          daily_notification_hour: number | null
          daily_notification_minute: number | null
          expiration_day_hour: number | null
          expiration_day_minute: number | null
          id: number
          monthly_notification_hour: number | null
          monthly_notification_minute: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_notification_hour?: number | null
          daily_notification_minute?: number | null
          expiration_day_hour?: number | null
          expiration_day_minute?: number | null
          id?: number
          monthly_notification_hour?: number | null
          monthly_notification_minute?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_notification_hour?: number | null
          daily_notification_minute?: number | null
          expiration_day_hour?: number | null
          expiration_day_minute?: number | null
          id?: number
          monthly_notification_hour?: number | null
          monthly_notification_minute?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          hide_from_view: boolean
          id: number
          link: string | null
          message: string
          shown: boolean
          timestamp: string | null
          user_id: number
          viewed: boolean | null
        }
        Insert: {
          hide_from_view?: boolean
          id?: number
          link?: string | null
          message: string
          shown?: boolean
          timestamp?: string | null
          user_id: number
          viewed?: boolean | null
        }
        Update: {
          hide_from_view?: boolean
          id?: number
          link?: string | null
          message?: string
          shown?: boolean
          timestamp?: string | null
          user_id?: number
          viewed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      opt_outs: {
        Row: {
          opted_out: boolean | null
          timestamp: string | null
          user_id: number
        }
        Insert: {
          opted_out?: boolean | null
          timestamp?: string | null
          user_id: number
        }
        Update: {
          opted_out?: boolean | null
          timestamp?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "opt_outs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          platform: string | null
          subscription: Json
          updated_at: string
          user_agent: string | null
          user_email: string
          user_id: number
        }
        Insert: {
          created_at?: string
          endpoint: string
          platform?: string | null
          subscription: Json
          updated_at?: string
          user_agent?: string | null
          user_email: string
          user_id: number
        }
        Update: {
          created_at?: string
          endpoint?: string
          platform?: string | null
          subscription?: Json
          updated_at?: string
          user_agent?: string | null
          user_email?: string
          user_id?: number
        }
        Relationships: []
      }
      push_system_config: {
        Row: {
          created_at: string
          id: number
          updated_at: string
          vapid_private_key: string
          vapid_public_key: string
          vapid_subject: string
        }
        Insert: {
          created_at?: string
          id: number
          updated_at?: string
          vapid_private_key: string
          vapid_public_key: string
          vapid_subject?: string
        }
        Update: {
          created_at?: string
          id?: number
          updated_at?: string
          vapid_private_key?: string
          vapid_public_key?: string
          vapid_subject?: string
        }
        Relationships: []
      }
      scheduled_tasks: {
        Row: {
          created_at: string | null
          created_by_user_id: number | null
          description: string | null
          execution_time: string
          id: number
          is_active: boolean
          last_run: string | null
          next_run: string | null
          schedule_type: string
          schedule_value: string | null
          task_name: string
          task_type: string
          timezone: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id?: number | null
          description?: string | null
          execution_time: string
          id?: number
          is_active: boolean
          last_run?: string | null
          next_run?: string | null
          schedule_type: string
          schedule_value?: string | null
          task_name: string
          task_type: string
          timezone: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: number | null
          description?: string | null
          execution_time?: string
          id?: number
          is_active?: boolean
          last_run?: string | null
          next_run?: string | null
          schedule_type?: string
          schedule_value?: string | null
          task_name?: string
          task_type?: string
          timezone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_tasks_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tag: {
        Row: {
          count: number
          id: number
          name: string
        }
        Insert: {
          count: number
          id?: number
          name: string
        }
        Update: {
          count?: number
          id?: number
          name?: string
        }
        Relationships: []
      }
      task_execution_logs: {
        Row: {
          additional_data: string | null
          error_message: string | null
          executed_at: string | null
          execution_time_seconds: number | null
          id: number
          result_message: string | null
          status: string
          task_id: number
        }
        Insert: {
          additional_data?: string | null
          error_message?: string | null
          executed_at?: string | null
          execution_time_seconds?: number | null
          id?: number
          result_message?: string | null
          status: string
          task_id: number
        }
        Update: {
          additional_data?: string | null
          error_message?: string | null
          executed_at?: string | null
          execution_time_seconds?: number | null
          id?: number
          result_message?: string | null
          status?: string
          task_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_execution_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "scheduled_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_users: {
        Row: {
          blocked_until: string | null
          created_at: string | null
          device_info: string | null
          disconnected_at: string | null
          id: number
          ip_address: string | null
          is_active: boolean | null
          is_disconnected: boolean | null
          is_verified: boolean | null
          last_interaction: string | null
          last_verification_attempt: string | null
          telegram_chat_id: number | null
          telegram_username: string | null
          user_hash: string | null
          user_id: number
          verification_attempts: number | null
          verification_expires_at: string
          verification_token: string
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string | null
          device_info?: string | null
          disconnected_at?: string | null
          id?: number
          ip_address?: string | null
          is_active?: boolean | null
          is_disconnected?: boolean | null
          is_verified?: boolean | null
          last_interaction?: string | null
          last_verification_attempt?: string | null
          telegram_chat_id?: number | null
          telegram_username?: string | null
          user_hash?: string | null
          user_id: number
          verification_attempts?: number | null
          verification_expires_at: string
          verification_token: string
        }
        Update: {
          blocked_until?: string | null
          created_at?: string | null
          device_info?: string | null
          disconnected_at?: string | null
          id?: number
          ip_address?: string | null
          is_active?: boolean | null
          is_disconnected?: boolean | null
          is_verified?: boolean | null
          last_interaction?: string | null
          last_verification_attempt?: string | null
          telegram_chat_id?: number | null
          telegram_username?: string | null
          user_hash?: string | null
          user_id?: number
          verification_attempts?: number | null
          verification_expires_at?: string
          verification_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_users_audit_log: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: number | null
          id: number
          new_values: Json | null
          old_values: Json | null
          telegram_user_id: number
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: number | null
          id?: number
          new_values?: Json | null
          old_values?: Json | null
          telegram_user_id: number
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: number | null
          id?: number
          new_values?: Json | null
          old_values?: Json | null
          telegram_user_id?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          action: string | null
          buyer_confirmed: boolean | null
          buyer_confirmed_at: string | null
          buyer_email_sent_at: string | null
          buyer_id: number | null
          buyer_phone: string | null
          buyer_request_sent_at: string | null
          coupon_code_entered: boolean | null
          coupon_id: number
          created_at: string
          details: string | null
          id: number
          seller_approved: boolean | null
          seller_confirmed: boolean | null
          seller_confirmed_at: string | null
          seller_email_sent_at: string | null
          seller_id: number
          seller_phone: string | null
          source: string | null
          status: string
          timestamp: string | null
          transaction_date: string | null
          updated_at: string | null
        }
        Insert: {
          action?: string | null
          buyer_confirmed?: boolean | null
          buyer_confirmed_at?: string | null
          buyer_email_sent_at?: string | null
          buyer_id?: number | null
          buyer_phone?: string | null
          buyer_request_sent_at?: string | null
          coupon_code_entered?: boolean | null
          coupon_id: number
          created_at: string
          details?: string | null
          id?: number
          seller_approved?: boolean | null
          seller_confirmed?: boolean | null
          seller_confirmed_at?: string | null
          seller_email_sent_at?: string | null
          seller_id: number
          seller_phone?: string | null
          source?: string | null
          status: string
          timestamp?: string | null
          transaction_date?: string | null
          updated_at?: string | null
        }
        Update: {
          action?: string | null
          buyer_confirmed?: boolean | null
          buyer_confirmed_at?: string | null
          buyer_email_sent_at?: string | null
          buyer_id?: number | null
          buyer_phone?: string | null
          buyer_request_sent_at?: string | null
          coupon_code_entered?: boolean | null
          coupon_id?: number
          created_at?: string
          details?: string | null
          id?: number
          seller_approved?: boolean | null
          seller_confirmed?: boolean | null
          seller_confirmed_at?: string | null
          seller_email_sent_at?: string | null
          seller_id?: number
          seller_phone?: string | null
          source?: string | null
          status?: string
          timestamp?: string | null
          transaction_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupon"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activities: {
        Row: {
          action: string
          activity_id: number
          as_info: string | null
          browser: string | null
          city: string | null
          country: string | null
          country_code: string | null
          coupon_id: number | null
          device: string | null
          duration: number | null
          extra_metadata: Json | null
          geo_location: string | null
          ip_address: string | null
          isp: string | null
          lat: number | null
          lon: number | null
          org: string | null
          region: string | null
          timestamp: string | null
          timezone: string | null
          user_id: number | null
          zip: string | null
        }
        Insert: {
          action: string
          activity_id?: number
          as_info?: string | null
          browser?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          coupon_id?: number | null
          device?: string | null
          duration?: number | null
          extra_metadata?: Json | null
          geo_location?: string | null
          ip_address?: string | null
          isp?: string | null
          lat?: number | null
          lon?: number | null
          org?: string | null
          region?: string | null
          timestamp?: string | null
          timezone?: string | null
          user_id?: number | null
          zip?: string | null
        }
        Update: {
          action?: string
          activity_id?: number
          as_info?: string | null
          browser?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          coupon_id?: number | null
          device?: string | null
          duration?: number | null
          extra_metadata?: Json | null
          geo_location?: string | null
          ip_address?: string | null
          isp?: string | null
          lat?: number | null
          lon?: number | null
          org?: string | null
          region?: string | null
          timestamp?: string | null
          timezone?: string | null
          user_id?: number | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consents: {
        Row: {
          consent_id: number
          consent_status: boolean | null
          ip_address: string | null
          timestamp: string | null
          user_id: number | null
          version: string | null
        }
        Insert: {
          consent_id?: number
          consent_status?: boolean | null
          ip_address?: string | null
          timestamp?: string | null
          user_id?: number | null
          version?: string | null
        }
        Update: {
          consent_id?: number
          consent_status?: boolean | null
          ip_address?: string | null
          timestamp?: string | null
          user_id?: number | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feature_overrides: {
        Row: {
          created_at: string
          feature_key: string
          id: number
          is_enabled: boolean
          updated_at: string
          user_id: number
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: number
          is_enabled?: boolean
          updated_at?: string
          user_id: number
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: number
          is_enabled?: boolean
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_feature_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ratings: {
        Row: {
          created_at: string | null
          id: number
          rated_user_id: number
          rating_comment: string | null
          rating_user_id: number
          rating_value: number
        }
        Insert: {
          created_at?: string | null
          id?: number
          rated_user_id: number
          rating_comment?: string | null
          rating_user_id: number
          rating_value: number
        }
        Update: {
          created_at?: string | null
          id?: number
          rated_user_id?: number
          rating_comment?: string | null
          rating_user_id?: number
          rating_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_ratings_rated_user_id_fkey"
            columns: ["rated_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_ratings_rating_user_id_fkey"
            columns: ["rating_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reviews: {
        Row: {
          coffee_transaction: number | null
          comment: string | null
          created_at: string
          id: number
          rating: number | null
          reviewed_user_id: number
          reviewer_id: number
          transaction_id: number | null
        }
        Insert: {
          coffee_transaction?: number | null
          comment?: string | null
          created_at?: string
          id?: number
          rating?: number | null
          reviewed_user_id: number
          reviewer_id: number
          transaction_id?: number | null
        }
        Update: {
          coffee_transaction?: number | null
          comment?: string | null
          created_at?: string
          id?: number
          rating?: number | null
          reviewed_user_id?: number
          reviewer_id?: number
          transaction_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_reviews_reviewed_user_id_fkey"
            columns: ["reviewed_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tour_progress: {
        Row: {
          add_coupon_timestamp: string | null
          coupon_detail_timestamp: string | null
          id: number
          index_timestamp: string | null
          user_id: number
        }
        Insert: {
          add_coupon_timestamp?: string | null
          coupon_detail_timestamp?: string | null
          id?: number
          index_timestamp?: string | null
          user_id: number
        }
        Update: {
          add_coupon_timestamp?: string | null
          coupon_detail_timestamp?: string | null
          id?: number
          index_timestamp?: string | null
          user_id?: number
        }
        Relationships: []
      }
      users: {
        Row: {
          age: number | null
          allow_widget_access: boolean | null
          auth_user_id: string | null
          coupons_sold_count: number | null
          created_at: string
          email: string
          first_name: string
          gender: string | null
          google_id: string | null
          id: number
          is_admin: boolean
          is_confirmed: boolean
          is_deleted: boolean | null
          last_name: string
          newsletter_image: string | null
          newsletter_subscription: boolean
          password: string | null
          profile_description: string | null
          profile_image: string | null
          push_token: string | null
          region: string | null
          slots: number
          slots_automatic_coupons: number
          telegram_monthly_summary: boolean
        }
        Insert: {
          age?: number | null
          allow_widget_access?: boolean | null
          auth_user_id?: string | null
          coupons_sold_count?: number | null
          created_at?: string
          email: string
          first_name: string
          gender?: string | null
          google_id?: string | null
          id?: number
          is_admin?: boolean
          is_confirmed?: boolean
          is_deleted?: boolean | null
          last_name: string
          newsletter_image?: string | null
          newsletter_subscription?: boolean
          password?: string | null
          profile_description?: string | null
          profile_image?: string | null
          push_token?: string | null
          region?: string | null
          slots?: number
          slots_automatic_coupons?: number
          telegram_monthly_summary?: boolean
        }
        Update: {
          age?: number | null
          allow_widget_access?: boolean | null
          auth_user_id?: string | null
          coupons_sold_count?: number | null
          created_at?: string
          email?: string
          first_name?: string
          gender?: string | null
          google_id?: string | null
          id?: number
          is_admin?: boolean
          is_confirmed?: boolean
          is_deleted?: boolean | null
          last_name?: string
          newsletter_image?: string | null
          newsletter_subscription?: boolean
          password?: string | null
          profile_description?: string | null
          profile_image?: string | null
          push_token?: string | null
          region?: string | null
          slots?: number
          slots_automatic_coupons?: number
          telegram_monthly_summary?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_user_id: { Args: never; Returns: number }
      get_consolidated_transactions: {
        Args: { coupon_id_param: number }
        Returns: {
          action: string
          coupon_id: number
          details: string
          id: number
          source_table: string
          timestamp: string
          transaction_amount: number
        }[]
      }
      get_widget_companies: {
        Args: never
        Returns: {
          company_count: number
          id: number
          image_path: string
          name: string
        }[]
      }
      get_widget_coupons: {
        Args: { p_user_id: number }
        Returns: {
          code: string
          company: string
          cost: number
          date_added: string
          description: string
          expiration: string
          id: number
          is_one_time: boolean
          remaining_value: number
          show_in_widget: boolean
          status: string
          used_value: number
          user_id: number
          value: number
        }[]
      }
      get_widget_statistics: {
        Args: { p_user_id: number }
        Returns: {
          active_coupons_count: number
          total_remaining_value: number
        }[]
      }
      is_app_admin: { Args: never; Returns: boolean }
      mark_coupon_as_used_rpc: {
        Args: { p_coupon_id: number }
        Returns: undefined
      }
      trigger_hourly_multipass_update: { Args: never; Returns: undefined }
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
