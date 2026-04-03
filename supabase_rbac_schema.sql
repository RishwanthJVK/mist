-- MIST RBAC & Realtime Schema

-- 1. Create a table for managing Roles (Admin vs Participant)
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid references auth.users not null primary key,
  role text not null check (role in ('admin', 'participant'))
);

-- 2. Create the Real-time Participant State table for Remote Control and Dashboard Sync
CREATE TABLE IF NOT EXISTS public.participant_state (
  participant_id uuid references auth.users not null primary key,
  username text not null,
  current_mode text default 'REST',
  accuracy numeric default 0,
  latest_response_time numeric default 0,
  mode_started_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_state ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent "already exists" errors
DROP POLICY IF EXISTS "Public can read roles" ON public.user_roles;
DROP POLICY IF EXISTS "Public can read states" ON public.participant_state;
DROP POLICY IF EXISTS "Authenticated users can update their own state" ON public.participant_state;
DROP POLICY IF EXISTS "Admins can manage participant_state" ON public.participant_state;
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;

-- Allow anyone to read roles and states
CREATE POLICY "Public can read roles" ON public.user_roles FOR SELECT TO public USING (true);
CREATE POLICY "Public can read states" ON public.participant_state FOR SELECT TO public USING (true);

-- Allow participants to manage their OWN state
CREATE POLICY "Authenticated users can update their own state" ON public.participant_state FOR ALL TO authenticated USING (auth.uid() = participant_id) WITH CHECK (auth.uid() = participant_id);

-- Create a SECURITY DEFINER function to check admin status without triggering infinite recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow Admins to manage ALL states and roles (Bypasses RLS limits for admins)
CREATE POLICY "Admins can manage participant_state" ON public.participant_state FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can manage user_roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Enable Supabase Realtime broadcast for participant_state
DO $$
BEGIN
  -- Try to remove it first if it exists to avoid duplication errors
  ALTER PUBLICATION supabase_realtime DROP TABLE participant_state;
EXCEPTION WHEN undefined_object THEN
  -- do nothing if it wasn't there
END
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE participant_state;

--- IMPORTANT: ADMIN ACCOUNT CREATION INSTRUCTIONS ---
-- 1. Go to "Authentication" -> "Users" -> "Add User" -> "Create New User". 
-- 2. Enter email: admin@mist.com and password: iamadmin123
-- 3. Run the following SQL to safely auto-link that account as Admin:

INSERT INTO public.user_roles (user_id, role) 
SELECT id, 'admin' FROM auth.users WHERE email = 'admin@mist.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';