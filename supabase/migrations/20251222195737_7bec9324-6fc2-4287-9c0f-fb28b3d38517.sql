-- Tighten candidate data visibility: only admins can SELECT from public.candidates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'candidates'
      AND policyname = 'Users can view candidates for accessible jobs'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view candidates for accessible jobs" ON public.candidates';
  END IF;
END $$;

CREATE POLICY "Admins can view candidates"
ON public.candidates
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.job_positions jp
    WHERE jp.id = candidates.job_position_id
      AND jp.user_id = auth.uid()
      AND public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- Public/sanitized candidate access for non-admin users via SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.get_candidates_public(_job_position_id uuid)
RETURNS TABLE (
  id uuid,
  job_position_id uuid,
  name text,
  technical_score integer,
  experience_score integer,
  soft_skills_score integer,
  final_score numeric,
  recommendation public.recommendation_level,
  ai_evaluation text,
  strengths text[],
  weaknesses text[],
  summary text,
  analyzed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    c.id,
    c.job_position_id,
    c.name,
    c.technical_score,
    c.experience_score,
    c.soft_skills_score,
    c.final_score,
    c.recommendation,
    c.ai_evaluation,
    c.strengths,
    c.weaknesses,
    c.summary,
    c.analyzed_at
  FROM public.candidates c
  WHERE c.job_position_id = _job_position_id
    AND EXISTS (
      SELECT 1
      FROM public.job_positions jp
      WHERE jp.id = c.job_position_id
        AND (
          jp.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.user_job_access uja
            WHERE uja.user_id = auth.uid()
              AND uja.job_position_id = jp.id
          )
        )
    )
  ORDER BY c.final_score DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.get_candidate_public(_candidate_id uuid)
RETURNS TABLE (
  id uuid,
  job_position_id uuid,
  name text,
  technical_score integer,
  experience_score integer,
  soft_skills_score integer,
  final_score numeric,
  recommendation public.recommendation_level,
  ai_evaluation text,
  strengths text[],
  weaknesses text[],
  summary text,
  analyzed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    c.id,
    c.job_position_id,
    c.name,
    c.technical_score,
    c.experience_score,
    c.soft_skills_score,
    c.final_score,
    c.recommendation,
    c.ai_evaluation,
    c.strengths,
    c.weaknesses,
    c.summary,
    c.analyzed_at
  FROM public.candidates c
  WHERE c.id = _candidate_id
    AND EXISTS (
      SELECT 1
      FROM public.job_positions jp
      WHERE jp.id = c.job_position_id
        AND (
          jp.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.user_job_access uja
            WHERE uja.user_id = auth.uid()
              AND uja.job_position_id = jp.id
          )
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_candidates_public(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_candidate_public(uuid) TO authenticated;
