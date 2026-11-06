-- Migration: Add INSERT policy for users table
-- Created: 2026-05-22
-- Description: Adds missing INSERT policy for users table to allow authenticated user creation.
--              Note: service_role (used server-side) bypasses RLS, but explicit policies
--              ensure clarity and prevent potential issues with Supabase version updates.

-- Add INSERT policy for users (allow insert on own record)
-- This policy is optional since service_role bypasses RLS, but it ensures consistency
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
create policy "users_insert_own" on public.users
  for insert
  with check (id = auth.uid()::text);

