-- Table to store Google Sheets configurations per job position
CREATE TABLE public.google_sheets_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_position_id UUID NOT NULL REFERENCES public.job_positions(id) ON DELETE CASCADE,
  sheet_id TEXT NOT NULL,
  sheet_name TEXT DEFAULT 'Form Responses 1',
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_position_id)
);

-- Table to store column mappings and evaluation rules
CREATE TABLE public.column_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  google_sheets_config_id UUID NOT NULL REFERENCES public.google_sheets_config(id) ON DELETE CASCADE,
  column_index INTEGER NOT NULL,
  column_name TEXT NOT NULL,
  mapping_type TEXT NOT NULL CHECK (mapping_type IN ('name', 'email', 'phone', 'technical', 'experience', 'soft_skills', 'knockout', 'info', 'ignore')),
  weight INTEGER DEFAULT 0 CHECK (weight >= 0 AND weight <= 100),
  is_knockout BOOLEAN DEFAULT FALSE,
  knockout_value TEXT,
  knockout_operator TEXT CHECK (knockout_operator IN ('equals', 'not_equals', 'contains', 'less_than', 'greater_than')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store candidate responses from Google Sheets
CREATE TABLE public.candidate_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  column_mapping_id UUID NOT NULL REFERENCES public.column_mappings(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  ai_analysis TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_sheets_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.column_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for google_sheets_config
CREATE POLICY "Users can view their job position configs"
ON public.google_sheets_config FOR SELECT
USING (EXISTS (
  SELECT 1 FROM job_positions jp 
  WHERE jp.id = google_sheets_config.job_position_id 
  AND jp.user_id = auth.uid()
));

CREATE POLICY "Admins can insert configs"
ON public.google_sheets_config FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM job_positions jp 
  WHERE jp.id = google_sheets_config.job_position_id 
  AND jp.user_id = auth.uid() 
  AND has_role(auth.uid(), 'admin')
));

CREATE POLICY "Admins can update configs"
ON public.google_sheets_config FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM job_positions jp 
  WHERE jp.id = google_sheets_config.job_position_id 
  AND jp.user_id = auth.uid() 
  AND has_role(auth.uid(), 'admin')
));

CREATE POLICY "Admins can delete configs"
ON public.google_sheets_config FOR DELETE
USING (EXISTS (
  SELECT 1 FROM job_positions jp 
  WHERE jp.id = google_sheets_config.job_position_id 
  AND jp.user_id = auth.uid() 
  AND has_role(auth.uid(), 'admin')
));

-- RLS Policies for column_mappings
CREATE POLICY "Users can view column mappings"
ON public.column_mappings FOR SELECT
USING (EXISTS (
  SELECT 1 FROM google_sheets_config gsc
  JOIN job_positions jp ON jp.id = gsc.job_position_id
  WHERE gsc.id = column_mappings.google_sheets_config_id
  AND jp.user_id = auth.uid()
));

CREATE POLICY "Admins can insert column mappings"
ON public.column_mappings FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM google_sheets_config gsc
  JOIN job_positions jp ON jp.id = gsc.job_position_id
  WHERE gsc.id = column_mappings.google_sheets_config_id
  AND jp.user_id = auth.uid()
  AND has_role(auth.uid(), 'admin')
));

CREATE POLICY "Admins can update column mappings"
ON public.column_mappings FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM google_sheets_config gsc
  JOIN job_positions jp ON jp.id = gsc.job_position_id
  WHERE gsc.id = column_mappings.google_sheets_config_id
  AND jp.user_id = auth.uid()
  AND has_role(auth.uid(), 'admin')
));

CREATE POLICY "Admins can delete column mappings"
ON public.column_mappings FOR DELETE
USING (EXISTS (
  SELECT 1 FROM google_sheets_config gsc
  JOIN job_positions jp ON jp.id = gsc.job_position_id
  WHERE gsc.id = column_mappings.google_sheets_config_id
  AND jp.user_id = auth.uid()
  AND has_role(auth.uid(), 'admin')
));

-- RLS Policies for candidate_responses
CREATE POLICY "Users can view candidate responses"
ON public.candidate_responses FOR SELECT
USING (EXISTS (
  SELECT 1 FROM candidates c
  JOIN job_positions jp ON jp.id = c.job_position_id
  WHERE c.id = candidate_responses.candidate_id
  AND jp.user_id = auth.uid()
));

CREATE POLICY "Admins can insert candidate responses"
ON public.candidate_responses FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM candidates c
  JOIN job_positions jp ON jp.id = c.job_position_id
  WHERE c.id = candidate_responses.candidate_id
  AND jp.user_id = auth.uid()
  AND has_role(auth.uid(), 'admin')
));

CREATE POLICY "Admins can update candidate responses"
ON public.candidate_responses FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM candidates c
  JOIN job_positions jp ON jp.id = c.job_position_id
  WHERE c.id = candidate_responses.candidate_id
  AND jp.user_id = auth.uid()
  AND has_role(auth.uid(), 'admin')
));

CREATE POLICY "Admins can delete candidate responses"
ON public.candidate_responses FOR DELETE
USING (EXISTS (
  SELECT 1 FROM candidates c
  JOIN job_positions jp ON jp.id = c.job_position_id
  WHERE c.id = candidate_responses.candidate_id
  AND jp.user_id = auth.uid()
  AND has_role(auth.uid(), 'admin')
));

-- Trigger for updated_at
CREATE TRIGGER update_google_sheets_config_updated_at
BEFORE UPDATE ON public.google_sheets_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();