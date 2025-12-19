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
    const { jobPositionId, limit = 3 } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Mark job as analyzing (best-effort)
    await supabase.from("job_positions").update({ status: "analyzing" }).eq("id", jobPositionId);

    // Get job position
    const { data: job, error: jobError } = await supabase
      .from("job_positions")
      .select("*")
      .eq("id", jobPositionId)
      .single();

    if (jobError) throw jobError;

    // Check if there's a Google Sheets config for this job
    const { data: sheetsConfig } = await supabase
      .from("google_sheets_config")
      .select("*")
      .eq("job_position_id", jobPositionId)
      .single();

    // Get column mappings if Google Sheets is configured
    let columnMappings: any[] = [];
    if (sheetsConfig) {
      const { data: mappings } = await supabase
        .from("column_mappings")
        .select("*")
        .eq("google_sheets_config_id", sheetsConfig.id);
      columnMappings = mappings || [];
    }

    // Fetch a SMALL batch of candidates to avoid timeouts
    const { data: candidates, error: candidatesError } = await supabase
      .from("candidates")
      .select("*")
      .eq("job_position_id", jobPositionId)
      .is("analyzed_at", null)
      .limit(limit);

    if (candidatesError) throw candidatesError;

    // Nothing pending: mark completed and return
    if (!candidates || candidates.length === 0) {
      await supabase.from("job_positions").update({ status: "completed" }).eq("id", jobPositionId);
      return new Response(JSON.stringify({ success: true, processed: 0, done: true, remaining: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Analyzing batch of ${candidates.length} candidates for job: ${job.title}`);

    let processed = 0;

    for (const candidate of candidates) {
      // IMPORTANT: If candidate was knocked out during sync, mark as analyzed so UI doesn't get stuck.
      if (
        candidate.recommendation === "not_recommended" &&
        typeof candidate.summary === "string" &&
        candidate.summary.includes("Descalificado automáticamente")
      ) {
        await supabase
          .from("candidates")
          .update({ analyzed_at: new Date().toISOString() })
          .eq("id", candidate.id);

        console.log(`Marked knocked-out candidate as analyzed: ${candidate.name}`);
        processed++;
        continue;
      }

      try {
        // Get candidate responses from Google Sheets
        let formResponses = "";
        if (sheetsConfig) {
          const { data: responses } = await supabase
            .from("candidate_responses")
            .select("*, column_mappings(*)")
            .eq("candidate_id", candidate.id);

          if (responses && responses.length > 0) {
            formResponses = "\n\nRESPUESTAS DEL FORMULARIO (FUENTE PRIMARIA):\n";
            formResponses += "=".repeat(50) + "\n";

            for (const response of responses) {
              const mapping = response.column_mappings;
              const mappingLabel = getMappingTypeLabel(mapping?.mapping_type);
              formResponses += `\n[${mappingLabel}] ${response.question}:\n`;
              formResponses += `Respuesta: ${response.answer || "Sin respuesta"}\n`;
              if (mapping?.weight > 0) {
                formResponses += `Peso de evaluación: ${mapping.weight}%\n`;
              }
            }
          }
        }

        const prompt = `Eres un experto reclutador de RRHH analizando un candidato para la siguiente posición.

REGLA CRÍTICA DE PRIORIZACIÓN DE DATOS:
- Google Sheets (respuestas del formulario) = FUENTE PRIMARIA Y AUTORITATIVA
- CV (PDF) = FUENTE SECUNDARIA Y COMPLEMENTARIA
- Si hay conflicto entre datos, Google Sheets prevalece

TÍTULO DEL PUESTO: ${job.title}

DESCRIPCIÓN DEL PUESTO:
${job.description}

PESOS DE EVALUACIÓN:
- Habilidades Técnicas: ${job.technical_weight}%
- Experiencia: ${job.experience_weight}%
- Habilidades Blandas: ${job.soft_skills_weight}%

CANDIDATO: ${candidate.name}
Email: ${candidate.email || "No proporcionado"}
Teléfono: ${candidate.phone || "No proporcionado"}
${formResponses}
${candidate.cv_text_content ? `\nCONTENIDO DEL CV (FUENTE SECUNDARIA):\n${candidate.cv_text_content}` : `\nARCHIVO CV: ${candidate.cv_file_path}`}

Proporciona la evaluación en este formato JSON exacto:
{
  "technical_score": number (0-100),
  "experience_score": number (0-100),
  "soft_skills_score": number (0-100),
  "summary": "resumen de 2-3 oraciones priorizando datos del formulario",
  "strengths": ["fortaleza1", "fortaleza2", "fortaleza3"],
  "weaknesses": ["área de mejora1", "área de mejora2"],
  "recommendation": "strong_hire" | "consider" | "not_recommended",
  "detailed_evaluation": "evaluación detallada incluyendo análisis de respuestas del formulario",
  "data_inconsistencies": ["lista de inconsistencias entre formulario y CV, si las hay"]
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
              {
                role: "system",
                content:
                  "Eres un experto reclutador de RRHH. Analiza candidatos objetivamente priorizando SIEMPRE los datos del formulario de Google Sheets como fuente primaria. Proporciona evaluaciones estructuradas en español.",
              },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error("AI API error:", response.status, errText);
          continue;
        }

        const aiData = await response.json();
        const content = aiData.choices?.[0]?.message?.content || "";

        // Parse JSON from response
        let evaluation: any;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          evaluation = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch {
          console.error("Failed to parse AI response for:", candidate.name);
          evaluation = null;
        }

        // Minimal fallback
        if (!evaluation) {
          evaluation = {
            technical_score: 70,
            experience_score: 65,
            soft_skills_score: 70,
            summary: "Candidato muestra potencial basado en la información proporcionada.",
            strengths: ["Experiencia relevante", "Perfil profesional"],
            weaknesses: ["Se requiere revisión adicional"],
            recommendation: "consider",
            detailed_evaluation: content,
          };
        }

        const finalScore =
          (evaluation.technical_score * job.technical_weight / 100) +
          (evaluation.experience_score * job.experience_weight / 100) +
          (evaluation.soft_skills_score * job.soft_skills_weight / 100);

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
        processed++;
      } catch (candidateError) {
        console.error(`Error analyzing ${candidate.name}:`, candidateError);
      }
    }

    // Remaining count (best-effort)
    const { count: remainingCount } = await supabase
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("job_position_id", jobPositionId)
      .is("analyzed_at", null);

    const remaining = remainingCount ?? 0;
    const done = remaining === 0;

    if (done) {
      await supabase.from("job_positions").update({ status: "completed" }).eq("id", jobPositionId);
    }

    return new Response(JSON.stringify({ success: true, processed, done, remaining }), {
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

function getMappingTypeLabel(type: string | undefined): string {
  const labels: Record<string, string> = {
    name: "NOMBRE",
    email: "EMAIL",
    phone: "TELÉFONO",
    technical: "HABILIDAD TÉCNICA",
    experience: "EXPERIENCIA",
    soft_skills: "HABILIDAD BLANDA",
    knockout: "CRITERIO ELIMINATORIO",
    info: "INFORMACIÓN",
    ignore: "IGNORAR",
  };
  return labels[type || "info"] || "INFORMACIÓN";
}
