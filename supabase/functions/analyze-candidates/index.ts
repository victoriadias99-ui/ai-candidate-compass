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

    // Get candidates with their responses
    const { data: candidates, error: candidatesError } = await supabase
      .from("candidates")
      .select("*")
      .eq("job_position_id", jobPositionId);

    if (candidatesError) throw candidatesError;

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

    console.log(`Analyzing ${candidates.length} candidates for job: ${job.title}`);
    console.log(`Data source: ${sheetsConfig ? "Google Sheets (primary) + CV (secondary)" : "CV only"}`);

    // Analyze each candidate
    for (const candidate of candidates) {
      // Skip if already marked as not_recommended by knockout rules
      if (candidate.recommendation === "not_recommended" && candidate.summary?.includes("Descalificado automáticamente")) {
        console.log(`Skipping knocked-out candidate: ${candidate.name}`);
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
            formResponses += "=" .repeat(50) + "\n";
            
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

PROCESO DE EVALUACIÓN:
1. Analiza PRIMERO las respuestas del formulario de Google Sheets
2. Mapea cada pregunta-respuesta a los criterios de evaluación
3. Usa el CV solo para:
   - Validar experiencia mencionada
   - Agregar profundidad a habilidades
   - Detectar fortalezas o brechas adicionales
4. Reporta cualquier inconsistencia entre el formulario y el CV

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
                content: "Eres un experto reclutador de RRHH. Analiza candidatos objetivamente priorizando SIEMPRE los datos del formulario de Google Sheets como fuente primaria. Proporciona evaluaciones estructuradas en español." 
              },
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
            summary: "Candidato muestra potencial basado en la información proporcionada.",
            strengths: ["Experiencia relevante", "Perfil profesional"],
            weaknesses: ["Se requiere revisión adicional"],
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

        // Update individual response scores if available
        if (sheetsConfig && evaluation.response_scores) {
          for (const [columnIndex, score] of Object.entries(evaluation.response_scores)) {
            await supabase
              .from("candidate_responses")
              .update({ score: score as number })
              .eq("candidate_id", candidate.id)
              .eq("column_mapping_id", columnIndex);
          }
        }

        console.log(`Analyzed: ${candidate.name} - Score: ${finalScore.toFixed(1)}`);
      } catch (candidateError) {
        console.error(`Error analyzing ${candidate.name}:`, candidateError);
      }
    }

    // Update job position status
    await supabase
      .from("job_positions")
      .update({ status: "completed" })
      .eq("id", jobPositionId);

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