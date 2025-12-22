-- Create table for user-job access permissions (admins assign which jobs each user can see)
CREATE TABLE public.user_job_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_position_id uuid NOT NULL REFERENCES public.job_positions(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, job_position_id)
);

-- Enable RLS
ALTER TABLE public.user_job_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_job_access
CREATE POLICY "Admins can manage job access" ON public.user_job_access
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own job access" ON public.user_job_access
FOR SELECT USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_user_job_access_user_id ON public.user_job_access(user_id);
CREATE INDEX idx_user_job_access_job_id ON public.user_job_access(job_position_id);

-- Function to automatically assign 'user' role to new users
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- Trigger to assign 'user' role automatically on new user creation
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Update job_positions RLS to allow users to view jobs they have access to
DROP POLICY IF EXISTS "Users can view job positions they created" ON public.job_positions;

CREATE POLICY "Users can view accessible job positions" ON public.job_positions
FOR SELECT USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.user_job_access 
    WHERE user_job_access.user_id = auth.uid() 
    AND user_job_access.job_position_id = job_positions.id
  )
);

-- Update candidates RLS to allow users to view candidates for accessible jobs
DROP POLICY IF EXISTS "Users can view candidates for their job positions" ON public.candidates;

CREATE POLICY "Users can view candidates for accessible jobs" ON public.candidates
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.job_positions jp
    WHERE jp.id = candidates.job_position_id
    AND (
      jp.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_job_access 
        WHERE user_job_access.user_id = auth.uid() 
        AND user_job_access.job_position_id = jp.id
      )
    )
  )
);