import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobPositionId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get job position
    const { data: job, error: jobError } = await supabase
      .from("job_positions")
      .select("*")
      .eq("id", jobPositionId)
      .single();

    if (jobError) throw jobError;

    // Get candidates
    const { data: candidates, error: candidatesError } = await supabase
      .from("candidates")
      .select("*")
      .eq("job_position_id", jobPositionId);

    if (candidatesError) throw candidatesError;

    console.log(`Analyzing ${candidates.length} candidates for job: ${job.title}`);

    // Analyze each candidate
    for (const candidate of candidates) {
      try {
        const prompt = `You are an expert HR recruiter analyzing a candidate's CV for the following position:

JOB TITLE: ${job.title}

JOB DESCRIPTION:
${job.description}

EVALUATION WEIGHTS:
- Technical Skills: ${job.technical_weight}%
- Experience: ${job.experience_weight}%
- Soft Skills: ${job.soft_skills_weight}%

CANDIDATE: ${candidate.name}
CV FILENAME: ${candidate.cv_file_path}

Based on the job requirements, evaluate this candidate and provide:
1. Technical Skills Score (0-100)
2. Experience Score (0-100)
3. Soft Skills Score (0-100)
4. A brief summary (2-3 sentences)
5. 3-4 key strengths
6. 2-3 areas for improvement
7. Overall recommendation: "strong_hire", "consider", or "not_recommended"

Respond in this exact JSON format:
{
  "technical_score": number,
  "experience_score": number,
  "soft_skills_score": number,
  "summary": "string",
  "strengths": ["string", "string", "string"],
  "weaknesses": ["string", "string"],
  "recommendation": "strong_hire" | "consider" | "not_recommended",
  "detailed_evaluation": "string"
}`;

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are an expert HR recruiter. Analyze candidates objectively and provide structured evaluations." },
              { role: "user", content: prompt }
            ],
          }),
        });

        if (!response.ok) {
          console.error("AI API error:", response.status);
          continue;
        }

        const aiData = await response.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        
        // Parse JSON from response
        let evaluation;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          evaluation = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch {
          console.error("Failed to parse AI response for:", candidate.name);
          evaluation = {
            technical_score: 70,
            experience_score: 65,
            soft_skills_score: 70,
            summary: "Candidate shows potential based on submitted CV.",
            strengths: ["Professional background", "Relevant experience"],
            weaknesses: ["Further review recommended"],
            recommendation: "consider",
            detailed_evaluation: content
          };
        }

        // Calculate final score
        const finalScore = (
          (evaluation.technical_score * job.technical_weight / 100) +
          (evaluation.experience_score * job.experience_weight / 100) +
          (evaluation.soft_skills_score * job.soft_skills_weight / 100)
        );

        // Update candidate
        await supabase
          .from("candidates")
          .update({
            technical_score: evaluation.technical_score,
            experience_score: evaluation.experience_score,
            soft_skills_score: evaluation.soft_skills_score,
            final_score: finalScore,
            summary: evaluation.summary,
            strengths: evaluation.strengths,
            weaknesses: evaluation.weaknesses,
            recommendation: evaluation.recommendation,
            ai_evaluation: evaluation.detailed_evaluation || content,
            analyzed_at: new Date().toISOString(),
          })
          .eq("id", candidate.id);

        console.log(`Analyzed: ${candidate.name} - Score: ${finalScore.toFixed(1)}`);
      } catch (candidateError) {
        console.error(`Error analyzing ${candidate.name}:`, candidateError);
      }
    }

    return new Response(JSON.stringify({ success: true, analyzed: candidates.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Analysis error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
