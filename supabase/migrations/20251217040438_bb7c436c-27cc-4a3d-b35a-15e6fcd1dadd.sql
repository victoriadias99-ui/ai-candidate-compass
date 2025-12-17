-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create enum for recommendation levels
CREATE TYPE public.recommendation_level AS ENUM ('strong_hire', 'consider', 'not_recommended');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Create job_positions table
CREATE TABLE public.job_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  technical_weight INTEGER DEFAULT 60 CHECK (technical_weight >= 0 AND technical_weight <= 100),
  experience_weight INTEGER DEFAULT 25 CHECK (experience_weight >= 0 AND experience_weight <= 100),
  soft_skills_weight INTEGER DEFAULT 15 CHECK (soft_skills_weight >= 0 AND soft_skills_weight <= 100),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create candidates table
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_position_id UUID REFERENCES public.job_positions(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cv_file_path TEXT NOT NULL,
  cv_text_content TEXT,
  technical_score INTEGER DEFAULT 0 CHECK (technical_score >= 0 AND technical_score <= 100),
  experience_score INTEGER DEFAULT 0 CHECK (experience_score >= 0 AND experience_score <= 100),
  soft_skills_score INTEGER DEFAULT 0 CHECK (soft_skills_score >= 0 AND soft_skills_score <= 100),
  final_score NUMERIC(5,2) DEFAULT 0,
  recommendation recommendation_level,
  ai_evaluation TEXT,
  strengths TEXT[],
  weaknesses TEXT[],
  summary TEXT,
  analyzed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Job positions policies
CREATE POLICY "Users can view job positions they created" ON public.job_positions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert job positions" ON public.job_positions
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update own job positions" ON public.job_positions
  FOR UPDATE USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete own job positions" ON public.job_positions
  FOR DELETE USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

-- Candidates policies
CREATE POLICY "Users can view candidates for their job positions" ON public.candidates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.job_positions jp 
      WHERE jp.id = job_position_id AND jp.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert candidates" ON public.candidates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_positions jp 
      WHERE jp.id = job_position_id 
      AND jp.user_id = auth.uid() 
      AND public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Admins can update candidates" ON public.candidates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.job_positions jp 
      WHERE jp.id = job_position_id 
      AND jp.user_id = auth.uid() 
      AND public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Admins can delete candidates" ON public.candidates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.job_positions jp 
      WHERE jp.id = job_position_id 
      AND jp.user_id = auth.uid() 
      AND public.has_role(auth.uid(), 'admin')
    )
  );

-- Create trigger for profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Default all users to admin for now (first user gets admin)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for CVs
INSERT INTO storage.buckets (id, name, public) VALUES ('cvs', 'cvs', false);

-- Storage policies
CREATE POLICY "Users can upload CVs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'cvs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their CVs" ON storage.objects
  FOR SELECT USING (bucket_id = 'cvs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete CVs" ON storage.objects
  FOR DELETE USING (bucket_id = 'cvs' AND auth.uid() IS NOT NULL);

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_positions_updated_at
  BEFORE UPDATE ON public.job_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();