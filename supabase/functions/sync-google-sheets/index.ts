import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoogleServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

async function getAccessToken(serviceAccount: GoogleServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp,
    iat: now,
  };

  const encoder = new TextEncoder();
  
  const base64UrlEncode = (data: Uint8Array): string => {
    return btoa(String.fromCharCode(...data))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };

  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${signatureB64}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error("Failed to obtain access token");
  }
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobPositionId, configId, columnMappings } = await req.json();
    
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

    if (!serviceAccountJson) {
      throw new Error("Google service account not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const serviceAccount: GoogleServiceAccount = JSON.parse(serviceAccountJson);

    // Get Google Sheets config
    const { data: config, error: configError } = await supabase
      .from("google_sheets_config")
      .select("*")
      .eq("id", configId)
      .single();

    if (configError || !config) {
      throw new Error("Google Sheets config not found");
    }

    // Get column mappings
    const { data: mappings, error: mappingsError } = await supabase
      .from("column_mappings")
      .select("*")
      .eq("google_sheets_config_id", configId);

    if (mappingsError) {
      throw mappingsError;
    }

    console.log(`Syncing from sheet: ${config.sheet_id}`);

    // Fetch data from Google Sheets
    const accessToken = await getAccessToken(serviceAccount);
    const encodedSheetName = encodeURIComponent(config.sheet_name || "Form Responses 1");
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheet_id}/values/${encodedSheetName}`;
    
    const response = await fetch(sheetsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.status}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length <= 1) {
      return new Response(JSON.stringify({ success: true, synced: 0, message: "No data rows found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Find column indexes for name, email, phone
    const nameMapping = mappings.find((m: any) => m.mapping_type === "name");
    const emailMapping = mappings.find((m: any) => m.mapping_type === "email");
    const phoneMapping = mappings.find((m: any) => m.mapping_type === "phone");

    let syncedCount = 0;
    let skippedCount = 0;

    for (const row of dataRows) {
      try {
        const candidateName = nameMapping ? row[nameMapping.column_index] : `Candidato ${syncedCount + 1}`;
        const candidateEmail = emailMapping ? row[emailMapping.column_index] : null;
        const candidatePhone = phoneMapping ? row[phoneMapping.column_index] : null;

        if (!candidateName || candidateName.trim() === "") {
          skippedCount++;
          continue;
        }

        // Check knock-out rules
        let isKnockedOut = false;
        let knockoutReason = "";

        for (const mapping of mappings) {
          if (mapping.is_knockout && mapping.knockout_value) {
            const value = row[mapping.column_index]?.toString().toLowerCase() || "";
            const knockoutVal = mapping.knockout_value.toLowerCase();

            switch (mapping.knockout_operator) {
              case "equals":
                if (value === knockoutVal) {
                  isKnockedOut = true;
                  knockoutReason = `${headers[mapping.column_index]}: ${row[mapping.column_index]}`;
                }
                break;
              case "not_equals":
                if (value !== knockoutVal) {
                  isKnockedOut = true;
                  knockoutReason = `${headers[mapping.column_index]}: ${row[mapping.column_index]}`;
                }
                break;
              case "contains":
                if (value.includes(knockoutVal)) {
                  isKnockedOut = true;
                  knockoutReason = `${headers[mapping.column_index]}: ${row[mapping.column_index]}`;
                }
                break;
              case "less_than":
                if (parseFloat(value) < parseFloat(knockoutVal)) {
                  isKnockedOut = true;
                  knockoutReason = `${headers[mapping.column_index]}: ${row[mapping.column_index]}`;
                }
                break;
              case "greater_than":
                if (parseFloat(value) > parseFloat(knockoutVal)) {
                  isKnockedOut = true;
                  knockoutReason = `${headers[mapping.column_index]}: ${row[mapping.column_index]}`;
                }
                break;
            }
          }
          if (isKnockedOut) break;
        }

        // Create candidate
        const { data: candidate, error: candidateError } = await supabase
          .from("candidates")
          .insert({
            job_position_id: jobPositionId,
            name: candidateName,
            email: candidateEmail,
            phone: candidatePhone,
            cv_file_path: `google-sheets/${config.sheet_id}/${syncedCount}`,
            recommendation: isKnockedOut ? "not_recommended" : null,
            summary: isKnockedOut ? `Descalificado automáticamente: ${knockoutReason}` : null,
          })
          .select()
          .single();

        if (candidateError) {
          console.error("Error creating candidate:", candidateError);
          continue;
        }

        // Store all responses for this candidate
        for (const mapping of mappings) {
          if (mapping.mapping_type !== "ignore") {
            await supabase.from("candidate_responses").insert({
              candidate_id: candidate.id,
              column_mapping_id: mapping.id,
              question: headers[mapping.column_index] || `Columna ${mapping.column_index}`,
              answer: row[mapping.column_index] || "",
            });
          }
        }

        syncedCount++;
        console.log(`Synced candidate: ${candidateName}`);
      } catch (rowError) {
        console.error("Error processing row:", rowError);
      }
    }

    // Update last synced timestamp
    await supabase
      .from("google_sheets_config")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", configId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: syncedCount, 
        skipped: skippedCount,
        total: dataRows.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});