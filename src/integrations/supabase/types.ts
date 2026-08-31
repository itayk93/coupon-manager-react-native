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
          setting_value: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          setting_key: string
          setting_value?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          setting_key?: string
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
          cost: number
          cvv: string | null
          date_added: string | null
          deleted_at: string | null
          description: string | null
          expiration: string | null
          id: number
          public_id: string
          sale_id: number | null
          is_one_time: boolean | null
          last_code_view: string | null
          last_company_view: string | null
          last_detail_view: string | null
          last_scraped: string | null
          purpose: string | null
          show_in_widget: boolean | null
          source: string | null
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
          cost: number
          cvv?: string | null
          date_added?: string | null
          deleted_at?: string | null
          description?: string | null
          expiration?: string | null
          id?: number
          public_id?: string
          sale_id?: number | null
          is_one_time?: boolean | null
          last_code_view?: string | null
          last_company_view?: string | null
          last_detail_view?: string | null
          last_scraped?: string | null
          purpose?: string | null
          show_in_widget?: boolean | null
          source?: string | null
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
          cost?: number
          cvv?: string | null
          date_added?: string | null
          deleted_at?: string | null
          description?: string | null
          expiration?: string | null
          id?: number
          public_id?: string
          sale_id?: number | null
          is_one_time?: boolean | null
          last_code_view?: string | null
          last_company_view?: string | null
          last_detail_view?: string | null
          last_scraped?: string | null
          purpose?: string | null
          show_in_widget?: boolean | null
          source?: string | null
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
      coupon_alerts: {
        Row: {
          channel: string
          coupon_id: number
          id: number
          sent_at: string
          status: string
          user_id: number
          window_days: number
        }
        Insert: {
          channel: string
          coupon_id: number
          id?: number
          sent_at?: string
          status: string
          user_id: number
          window_days: number
        }
        Update: {
          channel?: string
          coupon_id?: number
          id?: number
          sent_at?: string
          status?: string
          user_id?: number
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupon_alerts_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupon"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          revoked_at: string | null
          recipient_email: string | null
          sale_id: number | null
          share_expires_at: string
          share_type: string
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
          revoked_at?: string | null
          recipient_email?: string | null
          sale_id?: number | null
          share_expires_at: string
          share_type?: string
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
          revoked_at?: string | null
          recipient_email?: string | null
          sale_id?: number | null
          share_expires_at?: string
          share_type?: string
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
          latitude: number | null
          longitude: number | null
          place_address: string | null
          place_name: string | null
          timestamp: string | null
          used_amount: number
        }
        Insert: {
          action?: string | null
          coupon_id: number
          details?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          place_address?: string | null
          place_name?: string | null
          timestamp?: string | null
          used_amount: number
        }
        Update: {
          action?: string | null
          coupon_id?: number
          details?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          place_address?: string | null
          place_name?: string | null
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
          created: string | null
          gpt_usage_id: number
          model: string | null
          prompt_tokens: number | null
          response_text: string | null
          total_tokens: number | null
          user_id: number
        }
        Insert: {
          completion_tokens?: number | null
          created?: string | null
          gpt_usage_id?: number
          model?: string | null
          prompt_tokens?: number | null
          response_text?: string | null
          total_tokens?: number | null
          user_id: number
        }
        Update: {
          completion_tokens?: number | null
          created?: string | null
          gpt_usage_id?: number
          model?: string | null
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
          id: number
          newsletter_id: number
          sent_at: string | null
          user_id: number
        }
        Insert: {
          delivery_status?: string | null
          id?: number
          newsletter_id: number
          sent_at?: string | null
          user_id: number
        }
        Update: {
          delivery_status?: string | null
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
          bundle_path: string | null
          created_at: string | null
          created_by: number | null
          email_subject: string | null
          hero_image_url: string | null
          id: number
          is_published: boolean | null
          is_sent: boolean | null
          newsletter_type: string | null
          preview_text: string | null
          sent_count: number | null
          title: string
          web_url: string | null
        }
        Insert: {
          bundle_path?: string | null
          created_at?: string | null
          created_by?: number | null
          email_subject?: string | null
          hero_image_url?: string | null
          id?: number
          is_published?: boolean | null
          is_sent?: boolean | null
          newsletter_type?: string | null
          preview_text?: string | null
          sent_count?: number | null
          title: string
          web_url?: string | null
        }
        Update: {
          bundle_path?: string | null
          created_at?: string | null
          created_by?: number | null
          email_subject?: string | null
          hero_image_url?: string | null
          id?: number
          is_published?: boolean | null
          is_sent?: boolean | null
          newsletter_type?: string | null
          preview_text?: string | null
          sent_count?: number | null
          title?: string
          web_url?: string | null
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
      notification_preferences: {
        Row: {
          created_at: string
          daily_within: number | null
          email: boolean
          in_app: boolean
          push: boolean
          quiet_until: string | null
          timezone: string
          type_channels: Json
          updated_at: string
          user_id: number
          windows: number[] | null
        }
        Insert: {
          created_at?: string
          daily_within?: number | null
          email?: boolean
          in_app?: boolean
          push?: boolean
          quiet_until?: string | null
          timezone?: string
          type_channels?: Json
          updated_at?: string
          user_id: number
          windows?: number[] | null
        }
        Update: {
          created_at?: string
          daily_within?: number | null
          email?: boolean
          in_app?: boolean
          push?: boolean
          quiet_until?: string | null
          timezone?: string
          type_channels?: Json
          updated_at?: string
          user_id?: number
          windows?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          hide_from_view: boolean
          id: number
          link: string | null
          message: string
          shown: boolean
          timestamp: string | null
          title: string | null
          type: string | null
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
          title?: string | null
          type?: string | null
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
          title?: string | null
          type?: string | null
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
          expo_token: string | null
          kind: string
          platform: string | null
          subscription: Json | null
          updated_at: string
          user_agent: string | null
          user_email: string
          user_id: number
        }
        Insert: {
          created_at?: string
          endpoint: string
          expo_token?: string | null
          kind?: string
          platform?: string | null
          subscription?: Json | null
          updated_at?: string
          user_agent?: string | null
          user_email: string
          user_id: number
        }
        Update: {
          created_at?: string
          endpoint?: string
          expo_token?: string | null
          kind?: string
          platform?: string | null
          subscription?: Json | null
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
      referral_campaigns: {
        Row: {
          active: boolean
          code: string
          created_at: string
          ends_at: string | null
          id: number
          name: string
          partner_name: string
          partner_user_id: number | null
          starts_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          ends_at?: string | null
          id?: number
          name: string
          partner_name: string
          partner_user_id?: number | null
          starts_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          ends_at?: string | null
          id?: number
          name?: string
          partner_name?: string
          partner_user_id?: number | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_campaigns_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "referral_admin_rows"
            referencedColumns: ["referred_user_id"]
          },
          {
            foreignKeyName: "referral_campaigns_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "referral_admin_rows"
            referencedColumns: ["referrer_user_id"]
          },
          {
            foreignKeyName: "referral_campaigns_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          campaign_id: number | null
          code: string
          created_at: string
          id: number
          revoked_at: string | null
          user_id: number
        }
        Insert: {
          campaign_id?: number | null
          code: string
          created_at?: string
          id?: number
          revoked_at?: string | null
          user_id: number
        }
        Update: {
          campaign_id?: number | null
          code?: string
          created_at?: string
          id?: number
          revoked_at?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "referral_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "referral_admin_rows"
            referencedColumns: ["referred_user_id"]
          },
          {
            foreignKeyName: "referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "referral_admin_rows"
            referencedColumns: ["referrer_user_id"]
          },
          {
            foreignKeyName: "referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          campaign_id: number
          created_at: string
          earned_at: string | null
          id: number
          label: string
          metric: string
          paid_at: string | null
          paid_by: number | null
          paid_note: string | null
          reward_type: string
          reward_value: number
          threshold: number
        }
        Insert: {
          campaign_id: number
          created_at?: string
          earned_at?: string | null
          id?: number
          label: string
          metric: string
          paid_at?: string | null
          paid_by?: number | null
          paid_note?: string | null
          reward_type: string
          reward_value: number
          threshold: number
        }
        Update: {
          campaign_id?: number
          created_at?: string
          earned_at?: string | null
          id?: number
          label?: string
          metric?: string
          paid_at?: string | null
          paid_by?: number | null
          paid_note?: string | null
          reward_type?: string
          reward_value?: number
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "referral_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "referral_admin_rows"
            referencedColumns: ["referred_user_id"]
          },
          {
            foreignKeyName: "referral_rewards_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "referral_admin_rows"
            referencedColumns: ["referrer_user_id"]
          },
          {
            foreignKeyName: "referral_rewards_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          activated_at: string | null
          active_days_31_60: number
          active_days_first_30: number
          campaign_id: number
          coupon_count: number
          created_at: string
          depth: number
          direct_referrer_user_id: number | null
          first_coupon_at: string | null
          fraud_reasons: string[]
          fraud_status: string
          id: number
          install_hash: string | null
          progress_checked_at: string | null
          referral_code: string
          referred_user_id: number
          registered_at: string
          retained_at: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: number | null
          status: string
        }
        Insert: {
          activated_at?: string | null
          active_days_31_60?: number
          active_days_first_30?: number
          campaign_id: number
          coupon_count?: number
          created_at?: string
          depth?: number
          direct_referrer_user_id?: number | null
          first_coupon_at?: string | null
          fraud_reasons?: string[]
          fraud_status?: string
          id?: number
          install_hash?: string | null
          progress_checked_at?: string | null
          referral_code: string
          referred_user_id: number
          registered_at: string
          retained_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: number | null
          status?: string
        }
        Update: {
          activated_at?: string | null
          active_days_31_60?: number
          active_days_first_30?: number
          campaign_id?: number
          coupon_count?: number
          created_at?: string
          depth?: number
          direct_referrer_user_id?: number | null
          first_coupon_at?: string | null
          fraud_reasons?: string[]
          fraud_status?: string
          id?: number
          install_hash?: string | null
          progress_checked_at?: string | null
          referral_code?: string
          referred_user_id?: number
          registered_at?: string
          retained_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "referral_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_direct_referrer_user_id_fkey"
            columns: ["direct_referrer_user_id"]
            isOneToOne: false
            referencedRelation: "referral_admin_rows"
            referencedColumns: ["referred_user_id"]
          },
          {
            foreignKeyName: "referrals_direct_referrer_user_id_fkey"
            columns: ["direct_referrer_user_id"]
            isOneToOne: false
            referencedRelation: "referral_admin_rows"
            referencedColumns: ["referrer_user_id"]
          },
          {
            foreignKeyName: "referrals_direct_referrer_user_id_fkey"
            columns: ["direct_referrer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "referral_admin_rows"
            referencedColumns: ["referred_user_id"]
          },
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "referral_admin_rows"
            referencedColumns: ["referrer_user_id"]
          },
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "referral_admin_rows"
            referencedColumns: ["referred_user_id"]
          },
          {
            foreignKeyName: "referrals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "referral_admin_rows"
            referencedColumns: ["referrer_user_id"]
          },
          {
            foreignKeyName: "referrals_reviewed_by_fkey"
            columns: ["reviewed_by"]
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
      ip_geo: {
        Row: {
          asn: string | null
          city: string | null
          country_code: string | null
          ip_address: string
          isp: string | null
          lookup_failed: boolean
          region: string | null
          resolved_at: string
          source: string
        }
        Insert: {
          asn?: string | null
          city?: string | null
          country_code?: string | null
          ip_address: string
          isp?: string | null
          lookup_failed?: boolean
          region?: string | null
          resolved_at?: string
          source: string
        }
        Update: {
          asn?: string | null
          city?: string | null
          country_code?: string | null
          ip_address?: string
          isp?: string | null
          lookup_failed?: boolean
          region?: string | null
          resolved_at?: string
          source?: string
        }
        Relationships: []
      }
      user_activities: {
        Row: {
          action: string
          activity_id: number
          city: string | null
          country_code: string | null
          coupon_id: number | null
          device: string | null
          extra_metadata: Json | null
          ip_address: string | null
          region: string | null
          timestamp: string | null
          user_id: number | null
        }
        Insert: {
          action: string
          activity_id?: number
          city?: string | null
          country_code?: string | null
          coupon_id?: number | null
          device?: string | null
          extra_metadata?: Json | null
          ip_address?: string | null
          region?: string | null
          timestamp?: string | null
          user_id?: number | null
        }
        Update: {
          action?: string
          activity_id?: number
          city?: string | null
          country_code?: string | null
          coupon_id?: number | null
          device?: string | null
          extra_metadata?: Json | null
          ip_address?: string | null
          region?: string | null
          timestamp?: string | null
          user_id?: number | null
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
          allow_widget_access: boolean | null
          auth_user_id: string | null
          created_at: string
          email: string
          first_name: string
          gender: string | null
          google_id: string | null
          id: number
          public_id: string
          is_admin: boolean
          is_confirmed: boolean
          is_deleted: boolean | null
          last_name: string
          marketing_consent_at: string | null
          marketing_consent_source: string | null
          marketing_consent_version: string | null
          newsletter_subscription: boolean
          password: string | null
          privacy_consent_at: string | null
          privacy_consent_version: string | null
          profile_description: string | null
          profile_image: string | null
          push_token: string | null
          slots: number
          slots_automatic_coupons: number
          telegram_monthly_summary: boolean
        }
        Insert: {
          allow_widget_access?: boolean | null
          auth_user_id?: string | null
          created_at?: string
          email: string
          first_name: string
          gender?: string | null
          google_id?: string | null
          id?: number
          public_id?: string
          is_admin?: boolean
          is_confirmed?: boolean
          is_deleted?: boolean | null
          last_name: string
          marketing_consent_at?: string | null
          marketing_consent_source?: string | null
          marketing_consent_version?: string | null
          newsletter_subscription?: boolean
          password?: string | null
          privacy_consent_at?: string | null
          privacy_consent_version?: string | null
          profile_description?: string | null
          profile_image?: string | null
          push_token?: string | null
          slots?: number
          slots_automatic_coupons?: number
          telegram_monthly_summary?: boolean
        }
        Update: {
          allow_widget_access?: boolean | null
          auth_user_id?: string | null
          created_at?: string
          email?: string
          first_name?: string
          gender?: string | null
          google_id?: string | null
          id?: number
          public_id?: string
          is_admin?: boolean
          is_confirmed?: boolean
          is_deleted?: boolean | null
          last_name?: string
          marketing_consent_at?: string | null
          marketing_consent_source?: string | null
          marketing_consent_version?: string | null
          newsletter_subscription?: boolean
          password?: string | null
          privacy_consent_at?: string | null
          privacy_consent_version?: string | null
          profile_description?: string | null
          profile_image?: string | null
          push_token?: string | null
          slots?: number
          slots_automatic_coupons?: number
          telegram_monthly_summary?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      referral_campaign_overview: {
        Row: {
          activated: number | null
          active: boolean | null
          code: string | null
          partner_email: string | null
          partner_user_id: number | null
          ends_at: string | null
          id: number | null
          in_review: number | null
          joined: number | null
          last_join_at: string | null
          partner_name: string | null
          rejected: number | null
          retained: number | null
          starts_at: string | null
        }
        Relationships: []
      }
      referral_admin_rows: {
        Row: {
          activated_at: string | null
          active_days_31_60: number | null
          active_days_first_30: number | null
          campaign_id: number | null
          coupon_count: number | null
          depth: number | null
          first_coupon_at: string | null
          fraud_reasons: string[] | null
          fraud_status: string | null
          id: number | null
          referral_code: string | null
          referred_email: string | null
          referred_name: string | null
          referred_user_id: number | null
          referrer_name: string | null
          referrer_user_id: number | null
          registered_at: string | null
          retained_at: string | null
          review_note: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "referral_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_geo_breakdown: {
        Args: { p_days: number }
        Returns: {
          region: string
          city: string
          users: number
          events: number
        }[]
      }
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
      record_coupon_usage: {
        Args: {
          p_coupon_id: number
          p_used_amount: number
          p_details?: string | null
          p_place_name?: string | null
          p_place_address?: string | null
          p_latitude?: number | null
          p_longitude?: number | null
          p_timestamp?: string | null
        }
        Returns: {
          new_used: number
          fully_used: boolean
        }[]
      }
      record_coupon_usage_batch: {
        Args: { p_coupon_id: number; p_usages: Json; p_import_key: string }
        Returns: { new_used: number; fully_used: boolean; inserted_count: number }[]
      }
      claim_referral: {
        Args: { p_code: string; p_install_hash?: string; p_user_id: number }
        Returns: string
      }
      my_referral_status: {
        Args: never
        Returns: {
          code: string
        }[]
      }
      referral_code_taken: {
        Args: { p_code: string }
        Returns: boolean
      }
      referral_create_campaign_for_user: {
        Args: { p_user_id: number }
        Returns: {
          code: string
          id: number
        }[]
      }
      referral_default_rewards: {
        Args: { p_campaign_id: number }
        Returns: undefined
      }
      referral_set_campaign_active: {
        Args: { p_active: boolean; p_campaign_id: number }
        Returns: undefined
      }
      referral_activity_days: {
        Args: { p_from: string; p_to: string; p_user_id: number }
        Returns: number
      }
      referral_fraud_reasons: {
        Args: { p_referral_id: number }
        Returns: string[]
      }
      referral_mark_reward_paid: {
        Args: { p_note?: string; p_reward_id: number }
        Returns: undefined
      }
      referral_qualifying_actions: { Args: never; Returns: string[] }
      referral_random_code: { Args: never; Returns: string }
      referral_refresh_now: {
        Args: { p_campaign_id?: number }
        Returns: number
      }
      referral_resolve_code: {
        Args: { p_code: string }
        Returns: {
          campaign_id: number
          depth: number
          referrer_user_id: number
        }[]
      }
      referral_set_fraud_status: {
        Args: { p_note?: string; p_referral_id: number; p_status: string }
        Returns: undefined
      }
      refresh_referral_progress: {
        Args: { p_campaign_id?: number }
        Returns: number
      }
      set_coupon_tags: {
        Args: { p_coupon_id: number; p_names: string[] }
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
