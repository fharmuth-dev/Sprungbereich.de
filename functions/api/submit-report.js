// ==========================================
// Cloudflare Pages Function — POST /api/submit-report
// ==========================================
// Nimmt Korrektur-Meldungen ("Änderung melden") entgegen, prüft server-seitig
// Turnstile + Honeypot, legt den Report per Supabase Service-Role-Key an und
// benachrichtigt den Admin per E-Mail (Resend). Gleiche Umgebungsvariablen
// wie submit-spot.js (siehe dort für Details).
// ==========================================

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;

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
    const safeReason = String(reason).slice(0, 200);
    const safeDetails = String(details || "").trim().slice(0, 2000);

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
        reason: safeReason,
        details: safeDetails
      }])
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error("Supabase insert error:", errText);
      return jsonResponse({ success: false, error: "Fehler beim Speichern in der Datenbank." }, 500);
    }

    // --- 5. Admin per E-Mail benachrichtigen (Spot-Namen kurz nachladen,
    //         damit die Mail verständlich ist statt nur eine ID zu zeigen) ---
    waitUntil((async () => {
      let spotTitle = `Spot #${spot_id}`;
      try {
        const spotRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/Spots?id=eq.${encodeURIComponent(spot_id)}&select=title`,
          { headers: { "apikey": env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
        );
        const spotData = await spotRes.json();
        if (Array.isArray(spotData) && spotData[0]?.title) spotTitle = spotData[0].title;
      } catch (e) { /* Fällt auf die ID zurück, kein Problem */ }

      await sendNotificationEmail(env, {
        subject: `✏️ Neue Korrektur-Meldung: ${spotTitle}`,
        html: `
          <p>Für <strong>${escapeHtml(spotTitle)}</strong> wurde eine Korrektur gemeldet:</p>
          <ul>
            <li><strong>Grund:</strong> ${escapeHtml(safeReason)}</li>
            <li><strong>Details:</strong> ${escapeHtml(safeDetails) || "–"}</li>
          </ul>
          <p>Zum Prüfen bitte in Supabase → Table Editor → spot_reports.</p>
        `
      });
    })());

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("submit-report Fehler:", err);
    return jsonResponse({ success: false, error: "Unerwarteter Serverfehler." }, 500);
  }
}

async function sendNotificationEmail(env, { subject, html }) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.RESEND_FROM || "Sprungbereich.de <onboarding@resend.dev>",
        to: [env.NOTIFY_EMAIL],
        subject,
        html
      })
    });
  } catch (err) {
    console.error("Resend-Fehler (E-Mail konnte nicht gesendet werden):", err);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
