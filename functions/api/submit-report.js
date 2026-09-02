// ==========================================
// Cloudflare Pages Function — POST /api/submit-report
// ==========================================
// Nimmt Korrektur-Meldungen ("Änderung melden") entgegen, prüft server-seitig
// Turnstile + Honeypot, und legt den Report erst danach per Supabase
// Service-Role-Key an. Gleiche Umgebungsvariablen wie submit-spot.js
// (siehe dort für Details).
// ==========================================

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    // --- 1. Honeypot ---
    if (body.website_hp) {
      return jsonResponse({ success: true });
    }

    // --- 2. Turnstile server-seitig verifizieren ---
    const token = body.turnstileToken;
    if (!token) {
      return jsonResponse({ success: false, error: "Sicherheitsprüfung fehlt." }, 400);
    }

    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: request.headers.get("CF-Connecting-IP") || ""
      })
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.success) {
      return jsonResponse({ success: false, error: "Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden und erneut versuchen." }, 403);
    }

    // --- 3. Eingaben validieren ---
    const { spot_id, reason, details } = body;
    if (!spot_id || !reason) {
      return jsonResponse({ success: false, error: "Fehlende Pflichtfelder." }, 400);
    }

    // --- 4. In Supabase speichern ---
    const insertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/spot_reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify([{
        spot_id: spot_id,
        reason: String(reason).slice(0, 200),
        details: String(details || "").trim().slice(0, 2000)
      }])
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error("Supabase insert error:", errText);
      return jsonResponse({ success: false, error: "Fehler beim Speichern in der Datenbank." }, 500);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("submit-report Fehler:", err);
    return jsonResponse({ success: false, error: "Unerwarteter Serverfehler." }, 500);
  }
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
