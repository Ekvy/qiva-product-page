/**
 * QIVA Newsletter — Brevo Proxy (Cloudflare Worker)
 * -------------------------------------------------
 * Nimmt die Newsletter-Anmeldung von der QIVA-Seite entgegen und meldet die
 * E-Mail-Adresse per Double-Opt-In bei Brevo an. Der Brevo-API-Key bleibt
 * serverseitig als Secret und taucht NIE im öffentlichen Seiten-Code auf.
 *
 * Deploy:
 *   1. Auf dash.cloudflare.com → Workers & Pages → Create Worker
 *   2. Diesen Code einfügen und deployen
 *   3. Settings → Variables → "Add secret":  BREVO_API_KEY = <dein Brevo API v3 Key>
 *      (Brevo → Settings → SMTP & API → API Keys → Generate a new API key)
 *   4. Die Worker-URL (z. B. https://qiva-newsletter.<name>.workers.dev)
 *      in js/main.js als NEWSLETTER_ENDPOINT eintragen.
 */

// --- Konfiguration ---------------------------------------------------------
const LIST_ID = 3;          // Brevo-Liste "QIVA Newsletter"
const DOI_TEMPLATE_ID = 5;  // Brevo-Template "QIVA — Double-Opt-In Bestätigung"
const REDIRECT_URL = "https://ekvy.github.io/qiva-product-page/?nl=ok#kaufen";
const DISCOUNT_CODE = "QIVA20";

// Nur diese Origins dürfen den Worker aufrufen (CORS).
const ALLOWED_ORIGINS = [
  "https://ekvy.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, cors);
    }

    const email = String(body.email || "").trim().toLowerCase();
    const source = String(body.source || "website").slice(0, 60);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "Ungültige E-Mail-Adresse" }, 400, cors);
    }

    const brevoRes = await fetch("https://api.brevo.com/v3/contacts/doubleOptinConfirmation", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        email,
        includeListIds: [LIST_ID],
        templateId: DOI_TEMPLATE_ID,
        redirectionUrl: REDIRECT_URL,
        attributes: { QUELLE: source, RABATTCODE: DISCOUNT_CODE },
      }),
    });

    // Brevo: 201 = neuer Kontakt, 204 = existierte bereits (beides OK).
    if (brevoRes.status === 201 || brevoRes.status === 204) {
      return json({ ok: true }, 200, cors);
    }

    let detail = "";
    try { detail = JSON.stringify(await brevoRes.json()); } catch { /* ignore */ }
    return json({ error: "Brevo-Fehler", status: brevoRes.status, detail }, 502, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
