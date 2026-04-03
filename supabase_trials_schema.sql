CREATE TABLE IF NOT EXISTS public.trials (
  id uuid default gen_random_uuid() primary key,
  participant_id uuid not null references auth.users(id) on delete cascade,
  condition_type text not null,
  difficulty_level integer not null,
  problem text not null,
  user_answer integer not null,
  is_correct boolean not null,
  response_time_ms numeric not null,
  current_limit_ms numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies for Trials Table
ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;

-- Drop existing to make it idempotent
DROP POLICY IF EXISTS "Admins can read all trials" ON public.trials;
DROP POLICY IF EXISTS "Participants can read their own trials" ON public.trials;
DROP POLICY IF EXISTS "Participants can insert their own trials" ON public.trials;

-- Admins can read all trial data
CREATE POLICY "Admins can read all trials" 
ON public.trials FOR SELECT 
TO authenticated 
USING (public.is_admin());

-- Participants can read their own historical trials
CREATE POLICY "Participants can read their own trials" 
ON public.trials FOR SELECT 
TO authenticated 
USING (auth.uid() = participant_id);

-- Participants can insert data into their own trials
CREATE POLICY "Participants can insert their own trials" 
ON public.trials FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = participant_id);

-- Admins can delete all trial data
CREATE POLICY "Admins can delete all trials" 
ON public.trials FOR DELETE 
TO authenticated 
USING (public.is_admin());
