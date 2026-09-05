// ==========================================
// Cloudflare Pages Function — POST /api/submit-spot
// ==========================================
// Nimmt neue Spot-Einreichungen entgegen, prüft server-seitig das Cloudflare
// Turnstile-Captcha + ein Honeypot-Feld, legt den Spot per Supabase
// Service-Role-Key an (status: 'pending') und benachrichtigt den Admin
// per E-Mail (Resend) über die neue Einreichung.
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
//   RESEND_API_KEY         API-Key von resend.com (Secret)
//   NOTIFY_EMAIL           E-Mail-Adresse, die benachrichtigt werden soll
//   RESEND_FROM             optional, Standard: onboarding@resend.dev
// ==========================================

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;

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
    const safeTitle = String(title).trim().slice(0, 200);
    const safeCity = String(city).trim().slice(0, 200);
    const safeDescription = String(description || "").trim().slice(0, 2000);

    // --- 4. In Supabase speichern (via Service-Role-Key, serverseitig) ---
    const baseRow = {
      title: safeTitle,
      city: safeCity,
      description: safeDescription,
      type: safeType,
      height: Number(height) || 0,
      facilities: Array.isArray(facilities) ? facilities.slice(0, 20) : [],
      website_url: website_url ? String(website_url).trim().slice(0, 300) : "",
      status: "pending",
      source: "community",
      latitude: Number(latitude),
      longitude: Number(longitude)
    };

    // Zusatzfelder nur mitschicken, wenn ausgefüllt
    const allowedPermissions = ["erlaubt", "aufsicht", "geduldet", "verboten"];
    const extraRow = { ...baseRow };
    if (allowedPermissions.includes(body.jump_allowed)) {
      extraRow.jump_allowed = body.jump_allowed;
    }
    if (body.water_depth) {
      extraRow.water_depth = String(body.water_depth).slice(0, 40);
    }

    const insertRow = async (row) => fetch(`${env.SUPABASE_URL}/rest/v1/Spots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify([row])
    });

    let insertRes = await insertRow(extraRow);

    // Fehlertoleranz: Existieren die neuen Spalten (jump_allowed / water_depth)
    // in Supabase noch nicht, wird ohne sie erneut gespeichert. So bricht die
    // Einreichung NIE, auch wenn die Spalten noch nicht angelegt wurden.
    if (!insertRes.ok && extraRow !== baseRow) {
      const firstError = await insertRes.clone().text();
      if (/column|schema|PGRST/i.test(firstError)) {
        console.warn("Neue Spalten fehlen in Supabase – speichere ohne sie:", firstError);
        insertRes = await insertRow(baseRow);
      }
    }

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error("Supabase insert error:", errText);
      return jsonResponse({ success: false, error: "Fehler beim Speichern in der Datenbank." }, 500);
    }

    // --- 5. Admin per E-Mail benachrichtigen (blockiert die Antwort an den
    //         Nutzer nicht, läuft im Hintergrund weiter) ---
    waitUntil(sendNotificationEmail(env, {
      subject: `🏊 Neuer Spot eingereicht: ${safeTitle}`,
      html: `
        <p>Ein neuer Spot wurde eingereicht und wartet auf Prüfung:</p>
        <ul>
          <li><strong>Name:</strong> ${escapeHtml(safeTitle)}</li>
          <li><strong>Ort:</strong> ${escapeHtml(safeCity)}</li>
          <li><strong>Typ:</strong> ${escapeHtml(safeType)}</li>
          <li><strong>Beschreibung:</strong> ${escapeHtml(safeDescription) || "–"}</li>
        </ul>
        <p>Zum Prüfen & Freischalten bitte in Supabase → Table Editor → Spots.</p>
      `
    }));

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("submit-spot Fehler:", err);
    return jsonResponse({ success: false, error: "Unerwarteter Serverfehler." }, 500);
  }
}

async function sendNotificationEmail(env, { subject, html }) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) return; // Benachrichtigung optional
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

