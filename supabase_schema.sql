-- MIST Explorer Supabase Schema Setup

-- Create the trials table
CREATE TABLE IF NOT EXISTS public.trials (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  participant_id text NOT NULL,
  condition_type text NOT NULL,
  difficulty_level integer,
  problem text NOT NULL,
  user_answer integer NOT NULL,
  is_correct boolean NOT NULL,
  response_time_ms integer,
  current_limit_ms integer
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous inserts (since auth is just participant ID string for now)
CREATE POLICY "Allow anonymous inserts to trials" 
ON public.trials 
FOR INSERT 
TO public 
WITH CHECK (true);

-- Create policy to allow public reads (optional, change depending on your security needs)
CREATE POLICY "Allow public reads of trials"
ON public.trials
FOR SELECT
TO public
USING (true);
