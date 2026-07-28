export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: number
          email: string
          google_id: string | null
          password: string
          first_name: string
          last_name: string
          age: number | null
          gender: string | null
          dismissed_message_id: number | null
          created_at: string
          profile_description: string | null
          profile_image: string | null
          is_confirmed: boolean
          is_admin: boolean
          is_deleted: boolean
          slots: number
          slots_automatic_coupons: number
          dismissed_expiring_alert_at: string | null
          newsletter_subscription: boolean
          telegram_monthly_summary: boolean
          show_whatsapp_banner: boolean
          pwa_prompt_dismissed: boolean | null
          pwa_installed: boolean | null
        }
        Insert: {
          id?: number
          email: string
          google_id?: string | null
          password: string
          first_name: string
          last_name: string
          age?: number | null
          gender?: string | null
          dismissed_message_id?: number | null
          created_at?: string
          profile_description?: string | null
          profile_image?: string | null
          is_confirmed?: boolean
          is_admin?: boolean
          is_deleted?: boolean
          slots?: number
          slots_automatic_coupons?: number
          dismissed_expiring_alert_at?: string | null
          newsletter_subscription?: boolean
          telegram_monthly_summary?: boolean
          show_whatsapp_banner?: boolean
          pwa_prompt_dismissed?: boolean | null
          pwa_installed?: boolean | null
        }
        Update: {
          id?: number
          email?: string
          google_id?: string | null
          password?: string
          first_name?: string
          last_name?: string
          age?: number | null
          gender?: string | null
          dismissed_message_id?: number | null
          created_at?: string
          profile_description?: string | null
          profile_image?: string | null
          is_confirmed?: boolean
          is_admin?: boolean
          is_deleted?: boolean
          slots?: number
          slots_automatic_coupons?: number
          dismissed_expiring_alert_at?: string | null
          newsletter_subscription?: boolean
          telegram_monthly_summary?: boolean
          show_whatsapp_banner?: boolean
          pwa_prompt_dismissed?: boolean | null
          pwa_installed?: boolean | null
        }
      }
      coupon: {
        Row: {
          id: number
          code: string
          description: string | null
          value: number
          cost: number
          company: string
          expiration: string | null
          source: string | null
          buyme_coupon_url: string | null
          strauss_coupon_url: string | null
          xgiftcard_coupon_url: string | null
          xtra_coupon_url: string | null
          date_added: string
          used_value: number
          status: string
          is_available: boolean
          is_for_sale: boolean
          is_one_time: boolean
          purpose: string | null
          exclude_saving: boolean
          auto_download_details: string | null
          user_id: number
          cvv: string | null
          card_exp: string | null
          reminder_sent_30_days: boolean
          reminder_sent_7_days: boolean
          reminder_sent_1_day: boolean
          notification_sent_pagh_tokev: boolean
          notification_sent_nutzel: boolean
          auto_update: boolean
          last_detail_view: string | null
          last_company_view: string | null
          last_code_view: string | null
          last_scraped: string | null
        }
        Insert: {
          id?: number
          code: string
          description?: string | null
          value: number
          cost: number
          company: string
          expiration?: string | null
          source?: string | null
          buyme_coupon_url?: string | null
          strauss_coupon_url?: string | null
          xgiftcard_coupon_url?: string | null
          xtra_coupon_url?: string | null
          date_added?: string
          used_value?: number
          status?: string
          is_available?: boolean
          is_for_sale?: boolean
          is_one_time?: boolean
          purpose?: string | null
          exclude_saving?: boolean
          auto_download_details?: string | null
          user_id: number
          cvv?: string | null
          card_exp?: string | null
          reminder_sent_30_days?: boolean
          reminder_sent_7_days?: boolean
          reminder_sent_1_day?: boolean
          notification_sent_pagh_tokev?: boolean
          notification_sent_nutzel?: boolean
          auto_update?: boolean
          last_detail_view?: string | null
          last_company_view?: string | null
          last_code_view?: string | null
          last_scraped?: string | null
        }
        Update: {
          id?: number
          code?: string
          description?: string | null
          value?: number
          cost?: number
          company?: string
          expiration?: string | null
          source?: string | null
          buyme_coupon_url?: string | null
          strauss_coupon_url?: string | null
          xgiftcard_coupon_url?: string | null
          xtra_coupon_url?: string | null
          date_added?: string
          used_value?: number
          status?: string
          is_available?: boolean
          is_for_sale?: boolean
          is_one_time?: boolean
          purpose?: string | null
          exclude_saving?: boolean
          auto_download_details?: string | null
          user_id?: number
          cvv?: string | null
          card_exp?: string | null
          reminder_sent_30_days?: boolean
          reminder_sent_7_days?: boolean
          reminder_sent_1_day?: boolean
          notification_sent_pagh_tokev?: boolean
          notification_sent_nutzel?: boolean
          auto_update?: boolean
          last_detail_view?: string | null
          last_company_view?: string | null
          last_code_view?: string | null
          last_scraped?: string | null
        }
      }
      tag: {
        Row: {
          id: number
          name: string
          count: number
        }
        Insert: {
          id?: number
          name: string
          count?: number
        }
        Update: {
          id?: number
          name?: string
          count?: number
        }
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
      }
      coupon_usage: {
        Row: {
          id: number
          coupon_id: number
          used_amount: number
          timestamp: string
          action: string | null
          details: string | null
        }
        Insert: {
          id?: number
          coupon_id: number
          used_amount: number
          timestamp?: string
          action?: string | null
          details?: string | null
        }
        Update: {
          id?: number
          coupon_id?: number
          used_amount?: number
          timestamp?: string
          action?: string | null
          details?: string | null
        }
      }
      notifications: {
        Row: {
          id: number
          message: string
          link: string | null
          timestamp: string
          viewed: boolean
          hide_from_view: boolean
          shown: boolean
          user_id: number
        }
        Insert: {
          id?: number
          message: string
          link?: string | null
          timestamp?: string
          viewed?: boolean
          hide_from_view?: boolean
          shown?: boolean
          user_id: number
        }
        Update: {
          id?: number
          message?: string
          link?: string | null
          timestamp?: string
          viewed?: boolean
          hide_from_view?: boolean
          shown?: boolean
          user_id?: number
        }
      }
      push_system_config: {
        Row: {
          id: number
          vapid_public_key: string
          vapid_private_key: string
          vapid_subject: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: number
          vapid_public_key: string
          vapid_private_key: string
          vapid_subject?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          vapid_public_key?: string
          vapid_private_key?: string
          vapid_subject?: string
          created_at?: string
          updated_at?: string
        }
      }
      push_subscriptions: {
        Row: {
          endpoint: string
          subscription: Json
          user_id: number
          user_email: string
          platform: string | null
          user_agent: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          endpoint: string
          subscription: Json
          user_id: number
          user_email: string
          platform?: string | null
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          endpoint?: string
          subscription?: Json
          user_id?: number
          user_email?: string
          platform?: string | null
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: number
          name: string
          image_path: string
          company_count: number
        }
        Insert: {
          id?: number
          name: string
          image_path: string
          company_count?: number
        }
        Update: {
          id?: number
          name?: string
          image_path?: string
          company_count?: number
        }
      }
      coupon_transaction: {
        Row: {
          id: number
          coupon_id: number
          transaction_date: string | null
          location: string | null
          recharge_amount: number | null
          usage_amount: number | null
          reference_number: string | null
          source: string
        }
        Insert: {
          id?: number
          coupon_id: number
          transaction_date?: string | null
          location?: string | null
          recharge_amount?: number | null
          usage_amount?: number | null
          reference_number?: string | null
          source?: string
        }
        Update: {
          id?: number
          coupon_id?: number
          transaction_date?: string | null
          location?: string | null
          recharge_amount?: number | null
          usage_amount?: number | null
          reference_number?: string | null
          source?: string
        }
      }
      coupon_requests: {
        Row: {
          id: number
          company: string
          other_company: string | null
          code: string | null
          value: number
          cost: number
          description: string | null
          user_id: number
          date_requested: string
          fulfilled: boolean
        }
        Insert: {
          id?: number
          company: string
          other_company?: string | null
          code?: string | null
          value: number
          cost: number
          description?: string | null
          user_id: number
          date_requested?: string
          fulfilled?: boolean
        }
        Update: {
          id?: number
          company?: string
          other_company?: string | null
          code?: string | null
          value?: number
          cost?: number
          description?: string | null
          user_id?: number
          date_requested?: string
          fulfilled?: boolean
        }
      }
      coupon_shares: {
        Row: {
          id: number
          coupon_id: number
          shared_by_user_id: number
          shared_with_user_id: number | null
          share_token: string
          status: string
          created_at: string
          accepted_at: string | null
          revoked_at: string | null
          share_expires_at: string
          revocation_token: string | null
          revocation_token_expires_at: string | null
          revocation_requested_by: number | null
          revocation_requested_at: string | null
        }
        Insert: {
          id?: number
          coupon_id: number
          shared_by_user_id: number
          shared_with_user_id?: number | null
          share_token: string
          status?: string
          created_at?: string
          accepted_at?: string | null
          revoked_at?: string | null
          share_expires_at: string
          revocation_token?: string | null
          revocation_token_expires_at?: string | null
          revocation_requested_by?: number | null
          revocation_requested_at?: string | null
        }
        Update: {
          id?: number
          coupon_id?: number
          shared_by_user_id?: number
          shared_with_user_id?: number | null
          share_token?: string
          status?: string
          created_at?: string
          accepted_at?: string | null
          revoked_at?: string | null
          share_expires_at?: string
          revocation_token?: string | null
          revocation_token_expires_at?: string | null
          revocation_requested_by?: number | null
          revocation_requested_at?: string | null
        }
      }
      admin_messages: {
        Row: {
          id: number
          message_text: string
          link_url: string | null
          link_text: string | null
          created_at: string
        }
        Insert: {
          id?: number
          message_text: string
          link_url?: string | null
          link_text?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          message_text?: string
          link_url?: string | null
          link_text?: string | null
          created_at?: string
        }
      }
      admin_settings: {
        Row: {
          id: number
          setting_key: string
          setting_value: string | null
          setting_type: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          setting_key: string
          setting_value?: string | null
          setting_type?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          setting_key?: string
          setting_value?: string | null
          setting_type?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      feature_access: {
        Row: {
          id: number
          feature_name: string
          access_mode: string | null
        }
        Insert: {
          id?: number
          feature_name: string
          access_mode?: string | null
        }
        Update: {
          id?: number
          feature_name?: string
          access_mode?: string | null
        }
      }
      user_tour_progress: {
        Row: {
          id: number
          user_id: number
          index_timestamp: string | null
          coupon_detail_timestamp: string | null
          add_coupon_timestamp: string | null
        }
        Insert: {
          id?: number
          user_id: number
          index_timestamp?: string | null
          coupon_detail_timestamp?: string | null
          add_coupon_timestamp?: string | null
        }
        Update: {
          id?: number
          user_id?: number
          index_timestamp?: string | null
          coupon_detail_timestamp?: string | null
          add_coupon_timestamp?: string | null
        }
      }
      newsletters: {
        Row: {
          id: number
          title: string
          content: string | null
          main_title: string | null
          additional_title: string | null
          telegram_bot_section: string | null
          website_features_section: string | null
          highlight_text: string | null
          custom_html: string | null
          newsletter_type: string
          image_path: string | null
          show_telegram_button: boolean
          created_at: string
          created_by: number
          is_published: boolean
          sent_count: number
          scheduled_send_time: string | null
          is_sent: boolean
        }
        Insert: {
          id?: number
          title: string
          content?: string | null
          main_title?: string | null
          additional_title?: string | null
          telegram_bot_section?: string | null
          website_features_section?: string | null
          highlight_text?: string | null
          custom_html?: string | null
          newsletter_type?: string
          image_path?: string | null
          show_telegram_button?: boolean
          created_at?: string
          created_by: number
          is_published?: boolean
          sent_count?: number
          scheduled_send_time?: string | null
          is_sent?: boolean
        }
        Update: {
          id?: number
          title?: string
          content?: string | null
          main_title?: string | null
          additional_title?: string | null
          telegram_bot_section?: string | null
          website_features_section?: string | null
          highlight_text?: string | null
          custom_html?: string | null
          newsletter_type?: string
          image_path?: string | null
          show_telegram_button?: boolean
          created_at?: string
          created_by?: number
          is_published?: boolean
          sent_count?: number
          scheduled_send_time?: string | null
          is_sent?: boolean
        }
      }
      newsletter_sendings: {
        Row: {
          id: number
          newsletter_id: number
          user_id: number
          sent_at: string
          delivery_status: string
          error_message: string | null
        }
        Insert: {
          id?: number
          newsletter_id: number
          user_id: number
          sent_at?: string
          delivery_status?: string
          error_message?: string | null
        }
        Update: {
          id?: number
          newsletter_id?: number
          user_id?: number
          sent_at?: string
          delivery_status?: string
          error_message?: string | null
        }
      }
      gpt_usage: {
        Row: {
          gpt_usage_id: number
          user_id: number
          created: string
          id: string | null
          object: string | null
          model: string | null
          prompt_tokens: number | null
          completion_tokens: number | null
          total_tokens: number | null
          cost_usd: number | null
          cost_ils: number | null
          exchange_rate: number | null
          prompt_text: string | null
          response_text: string | null
        }
        Insert: {
          gpt_usage_id?: number
          user_id: number
          created?: string
          id?: string | null
          object?: string | null
          model?: string | null
          prompt_tokens?: number | null
          completion_tokens?: number | null
          total_tokens?: number | null
          cost_usd?: number | null
          cost_ils?: number | null
          exchange_rate?: number | null
          prompt_text?: string | null
          response_text?: string | null
        }
        Update: {
          gpt_usage_id?: number
          user_id?: number
          created?: string
          id?: string | null
          object?: string | null
          model?: string | null
          prompt_tokens?: number | null
          completion_tokens?: number | null
          total_tokens?: number | null
          cost_usd?: number | null
          cost_ils?: number | null
          exchange_rate?: number | null
          prompt_text?: string | null
          response_text?: string | null
        }
      }
      user_consents: {
        Row: {
          consent_id: number
          user_id: number | null
          ip_address: string | null
          consent_status: boolean
          timestamp: string
          version: string
        }
        Insert: {
          consent_id?: number
          user_id?: number | null
          ip_address?: string | null
          consent_status?: boolean
          timestamp?: string
          version?: string
        }
        Update: {
          consent_id?: number
          user_id?: number | null
          ip_address?: string | null
          consent_status?: boolean
          timestamp?: string
          version?: string
        }
      }
      user_activities: {
        Row: {
          activity_id: number
          user_id: number | null
          action: string
          coupon_id: number | null
          timestamp: string
          ip_address: string | null
          device: string | null
          browser: string | null
          geo_location: string | null
          duration: number | null
          extra_metadata: string | null
        }
        Insert: {
          activity_id?: number
          user_id?: number | null
          action: string
          coupon_id?: number | null
          timestamp?: string
          ip_address?: string | null
          device?: string | null
          browser?: string | null
          geo_location?: string | null
          duration?: number | null
          extra_metadata?: string | null
        }
        Update: {
          activity_id?: number
          user_id?: number | null
          action?: string
          coupon_id?: number | null
          timestamp?: string
          ip_address?: string | null
          device?: string | null
          browser?: string | null
          geo_location?: string | null
          duration?: number | null
          extra_metadata?: string | null
        }
      }
      opt_outs: {
        Row: {
          user_id: number
          opted_out: boolean
          timestamp: string
        }
        Insert: {
          user_id: number
          opted_out?: boolean
          timestamp?: string
        }
        Update: {
          user_id?: number
          opted_out?: boolean
          timestamp?: string
        }
      }
      scheduled_tasks: {
        Row: {
          id: number
          task_name: string
          task_type: string
          schedule_type: string
          schedule_value: string | null
          execution_time: string
          timezone: string
          last_run: string | null
          next_run: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          description: string | null
          created_by_user_id: number | null
        }
        Insert: {
          id?: number
          task_name: string
          task_type: string
          schedule_type: string
          schedule_value?: string | null
          execution_time: string
          timezone?: string
          last_run?: string | null
          next_run?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          description?: string | null
          created_by_user_id?: number | null
        }
        Update: {
          id?: number
          task_name?: string
          task_type?: string
          schedule_type?: string
          schedule_value?: string | null
          execution_time?: string
          timezone?: string
          last_run?: string | null
          next_run?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          description?: string | null
          created_by_user_id?: number | null
        }
      }
      task_execution_logs: {
        Row: {
          id: number
          task_id: number
          executed_at: string
          status: string
          result_message: string | null
          error_message: string | null
          execution_time_seconds: number | null
          additional_data: string | null
        }
        Insert: {
          id?: number
          task_id: number
          executed_at?: string
          status: string
          result_message?: string | null
          error_message?: string | null
          execution_time_seconds?: number | null
          additional_data?: string | null
        }
        Update: {
          id?: number
          task_id?: number
          executed_at?: string
          status?: string
          result_message?: string | null
          error_message?: string | null
          execution_time_seconds?: number | null
          additional_data?: string | null
        }
      }
      auto_update_runs: {
        Row: {
          id: number
          user_id: number
          started_at: string
          finished_at: string | null
          status: string
          updated_count: number
          failed_count: number
          skipped_count: number
          message: string | null
          job_id: string | null
        }
        Insert: {
          id?: number
          user_id: number
          started_at?: string
          finished_at?: string | null
          status?: string
          updated_count?: number
          failed_count?: number
          skipped_count?: number
          message?: string | null
          job_id?: string | null
        }
        Update: {
          id?: number
          user_id?: number
          started_at?: string
          finished_at?: string | null
          status?: string
          updated_count?: number
          failed_count?: number
          skipped_count?: number
          message?: string | null
          job_id?: string | null
        }
      }
      coupon_active_viewers: {
        Row: {
          id: number
          coupon_id: number
          user_id: number
          last_activity: string
          session_id: string
        }
        Insert: {
          id?: number
          coupon_id: number
          user_id: number
          last_activity?: string
          session_id: string
        }
        Update: {
          id?: number
          coupon_id?: number
          user_id?: number
          last_activity?: string
          session_id?: string
        }
      }
      telegram_users: {
        Row: {
          id: number
          user_id: number
          telegram_chat_id: number | null
          telegram_username: string | null
          is_active: boolean
          created_at: string
          last_interaction: string
          verification_token: string | null
          verification_expires_at: string | null
          is_verified: boolean
          verification_attempts: number
          last_verification_attempt: string | null
          blocked_until: string | null
          ip_address: string | null
          device_info: string | null
        }
        Insert: {
          id?: number
          user_id: number
          telegram_chat_id?: number | null
          telegram_username?: string | null
          is_active?: boolean
          created_at?: string
          last_interaction?: string
          verification_token?: string | null
          verification_expires_at?: string | null
          is_verified?: boolean
          verification_attempts?: number
          last_verification_attempt?: string | null
          blocked_until?: string | null
          ip_address?: string | null
          device_info?: string | null
        }
        Update: {
          id?: number
          user_id?: number
          telegram_chat_id?: number | null
          telegram_username?: string | null
          is_active?: boolean
          created_at?: string
          last_interaction?: string
          verification_token?: string | null
          verification_expires_at?: string | null
          is_verified?: boolean
          verification_attempts?: number
          last_verification_attempt?: string | null
          blocked_until?: string | null
          ip_address?: string | null
          device_info?: string | null
        }
      }
    }
  }
}
