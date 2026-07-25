-- Migration: Add pwa_prompt_dismissed and pwa_installed to users table
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS pwa_prompt_dismissed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pwa_installed BOOLEAN DEFAULT FALSE;
