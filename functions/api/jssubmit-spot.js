// ==========================================
// Cloudflare Pages Function — POST /api/submit-spot
// ==========================================
// Nimmt neue Spot-Einreichungen entgegen, prüft server-seitig das Cloudflare
// Turnstile-Captcha + ein Honeypot-Feld, und legt den Spot erst DANACH per
// Supabase Service-Role-Key an (status: 'pending', wie bisher).
//
// WICHTIG: Diese Funktion ist der einzige Weg, wie neue Spots in die
// Datenbank gelangen sollen. Damit ein Bot nicht einfach direkt an Supabase
// vorbei-postet, MUSS in Supabase zusätzlich die anon-INSERT-Berechtigung
// auf der Tabelle "Spots" entfernt werden (siehe README im Projekt-Root).
//
// Benötigte Umgebungsvariablen (Cloudflare Pages → Settings → Environment
// Variables, als "Secret" anlegen):
//   SUPABASE_URL           z.B. https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY   euer neuer sb_secret_... Key (NIE im Frontend!)
//   TURNSTILE_SECRET_KEY   Secret Key aus dem Cloudflare Turnstile-Setup
// ==========================================

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    // --- 1. Honeypot: Bots füllen oft ALLE Felder aus, auch versteckte ---
    if (body.website_hp) {
      // Bot erkannt: Wir tun so, als wäre alles gut gelaufen, speichern aber nichts.
      return jsonResponse({ success: true });
    }

    // --- 2. Cloudflare Turnstile server-seitig verifizieren ---
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
    const { title, city, description, type, height, facilities, website_url, latitude, longitude } = body;

    if (!title || !String(title).trim() || !city || !String(city).trim()) {
      return jsonResponse({ success: false, error: "Name und Ort sind Pflichtfelder." }, 400);
    }
    if (latitude == null || longitude == null || isNaN(Number(latitude)) || isNaN(Number(longitude))) {
      return jsonResponse({ success: false, error: "Standort fehlt oder ist ungültig." }, 400);
    }

    const allowedTypes = ["Freibad", "Hallenbad", "Frei- und Hallenbad", "See"];
    const safeType = allowedTypes.includes(type) ? type : "Freibad";

    // --- 4. In Supabase speichern (via Service-Role-Key, serverseitig) ---
    const insertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/Spots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify([{
        title: String(title).trim().slice(0, 200),
        city: String(city).trim().slice(0, 200),
        description: String(description || "").trim().slice(0, 2000),
        type: safeType,
        height: Number(height) || 0,
        facilities: Array.isArray(facilities) ? facilities.slice(0, 20) : [],
        website_url: website_url ? String(website_url).trim().slice(0, 300) : "",
        status: "pending",
        source: "community",
        latitude: Number(latitude),
        longitude: Number(longitude)
      }])
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error("Supabase insert error:", errText);
      return jsonResponse({ success: false, error: "Fehler beim Speichern in der Datenbank." }, 500);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("submit-spot Fehler:", err);
    return jsonResponse({ success: false, error: "Unerwarteter Serverfehler." }, 500);
  }
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
