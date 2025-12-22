-- Add is_active column to profiles for user activation/deactivation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Create candidate_comments table for recruiters to add notes
CREATE TABLE IF NOT EXISTS public.candidate_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on candidate_comments
ALTER TABLE public.candidate_comments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view comments on candidates they have access to
CREATE POLICY "Users can view candidate comments"
ON public.candidate_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM candidates c
    JOIN job_positions jp ON jp.id = c.job_position_id
    WHERE c.id = candidate_comments.candidate_id
    AND jp.user_id = auth.uid()
  )
);

-- Policy: Users can insert comments on candidates they have access to
CREATE POLICY "Users can insert candidate comments"
ON public.candidate_comments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM candidates c
    JOIN job_positions jp ON jp.id = c.job_position_id
    WHERE c.id = candidate_comments.candidate_id
    AND jp.user_id = auth.uid()
  )
);

-- Policy: Users can update their own comments
CREATE POLICY "Users can update own comments"
ON public.candidate_comments
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can delete their own comments
CREATE POLICY "Users can delete own comments"
ON public.candidate_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at on candidate_comments
CREATE TRIGGER update_candidate_comments_updated_at
BEFORE UPDATE ON public.candidate_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_candidate_comments_candidate_id ON public.candidate_comments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_comments_user_id ON public.candidate_comments(user_id);

-- Add policy for admins to view all profiles (for user management)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Add policy for admins to update all profiles (for activation/deactivation)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Add policy for admins to manage user roles
CREATE POLICY "Admins can insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user roles"
ON public.user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Add policy for admins to view all user roles (for user management)
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
USING (has_role(auth.uid(), 'admin'));