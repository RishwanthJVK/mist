-- RLS POLICY FIX: Add WITH CHECK clauses so admins can UPDATE/DELETE any participant row
-- Run this in the Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can update their own state" ON public.participant_state;
DROP POLICY IF EXISTS "Admins can manage participant_state" ON public.participant_state;
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;

-- Re-create with correct WITH CHECK clauses
CREATE POLICY "Authenticated users can update their own state"
  ON public.participant_state FOR ALL TO authenticated
  USING (auth.uid() = participant_id)
  WITH CHECK (auth.uid() = participant_id);

CREATE POLICY "Admins can manage participant_state"
  ON public.participant_state FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage user_roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
