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

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

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

  // Import private key and sign
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

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  
  if (!tokenData.access_token) {
    console.error("Token response:", tokenData);
    throw new Error("Failed to obtain access token");
  }

  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sheetId, sheetName = "Form Responses 1" } = await req.json();
    
    if (!sheetId) {
      throw new Error("Sheet ID is required");
    }

    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) {
      throw new Error("Google service account not configured");
    }

    const serviceAccount: GoogleServiceAccount = JSON.parse(serviceAccountJson);
    console.log(`Fetching sheet: ${sheetId}, tab: ${sheetName}`);

    const accessToken = await getAccessToken(serviceAccount);

    // First fetch spreadsheet metadata to get available sheet names
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`;
    const metadataResponse = await fetch(metadataUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error("Google Sheets metadata error:", metadataResponse.status, errorText);
      throw new Error(`Error accessing spreadsheet. Make sure it's shared with the service account.`);
    }

    const metadata = await metadataResponse.json();
    const availableSheets = metadata.sheets?.map((s: any) => s.properties.title) || [];
    console.log("Available sheets:", availableSheets);

    // Check if requested sheet exists
    if (!availableSheets.includes(sheetName)) {
      throw new Error(`Sheet "${sheetName}" not found. Available sheets: ${availableSheets.join(", ")}`);
    }

    // Fetch spreadsheet data
    const encodedSheetName = encodeURIComponent(sheetName);
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedSheetName}`;
    
    const response = await fetch(sheetsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Sheets API error:", response.status, errorText);
      throw new Error(`Google Sheets API error: ${response.status}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) {
      return new Response(JSON.stringify({ headers: [], rows: [], totalRows: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // First row contains headers/questions
    const headers = rows[0];
    const dataRows = rows.slice(1);

    console.log(`Found ${headers.length} columns and ${dataRows.length} rows`);

    return new Response(
      JSON.stringify({
        headers,
        rows: dataRows,
        totalRows: dataRows.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Fetch Google Sheets error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});