/**
 * QIVA Newsletter — Brevo Proxy (Cloudflare Worker)
 * -------------------------------------------------
 * Nimmt die Newsletter-Anmeldung von der QIVA-Seite entgegen und meldet die
 * E-Mail-Adresse per Double-Opt-In bei Brevo an. Der Brevo-API-Key bleibt
 * serverseitig als Secret und taucht NIE im öffentlichen Seiten-Code auf.
 *
 * Einrichtung Schritt für Schritt: siehe README.md, Abschnitt
 * "Newsletter setup (Brevo + Cloudflare Worker)".
 */

// --- Konfiguration ---------------------------------------------------------
const LIST_ID = 4;          // Brevo-Liste "QIVA Newsletter"
const DOI_TEMPLATE_ID = 5;  // Brevo-Template "QIVA — Double-Opt-In Bestätigung"
const DISCOUNT_CODE = "QIVA20";

/**
 * Erlaubte Origins (CORS) und die Seite, auf der der Nutzer nach dem Klick auf
 * "Anmeldung bestätigen" landet. Beides an einer Stelle, damit es nicht
 * auseinanderläuft. Der Redirect richtet sich nach der Seite, von der die
 * Anmeldung kam — so funktioniert die Umstellung ekvy.github.io -> qiva.ch
 * ohne erneutes Deployen.
 */
const PRIMARY_ORIGIN = "https://qiva.ch";
const SITES = {
  "https://qiva.ch": "https://qiva.ch/?nl=ok#kaufen",
  "https://www.qiva.ch": "https://www.qiva.ch/?nl=ok#kaufen",
  // Fallback, solange die Domain noch nicht umgestellt ist:
  "https://ekvy.github.io": "https://ekvy.github.io/qiva-product-page/?nl=ok#kaufen",
  // Lokale Tests: Brevo braucht eine öffentlich erreichbare Redirect-URL,
  // der Bestätigungslink führt deshalb auf die Live-Seite.
  "http://localhost:8080": "https://qiva.ch/?nl=ok#kaufen",
  "http://127.0.0.1:8080": "https://qiva.ch/?nl=ok#kaufen",
};

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    // Unbekannte Origins bekommen keine CORS-Freigabe.
    if (!Object.prototype.hasOwnProperty.call(SITES, origin)) {
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }
    if (!env.BREVO_API_KEY) {
      return json({ error: "BREVO_API_KEY fehlt (Secret im Worker setzen)" }, 500, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, cors);
    }

    // Honeypot: das Feld ist auf der Seite unsichtbar. Nur Bots füllen es aus.
    // Wir antworten mit ok, damit der Bot den Filter nicht bemerkt.
    if (String(body.website || "").trim() !== "") {
      return json({ ok: true }, 200, cors);
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
        redirectionUrl: SITES[origin] || SITES[PRIMARY_ORIGIN],
        attributes: { QUELLE: source, RABATTCODE: DISCOUNT_CODE },
      }),
    });

    // Brevo: 201 = DOI-Mail verschickt, 204 = Kontakt existierte bereits (beides OK).
    if (brevoRes.status === 201 || brevoRes.status === 204) {
      return json({ ok: true }, 200, cors);
    }

    // Details landen nur im Worker-Log, nicht in der Antwort an den Browser.
    let detail = "";
    try { detail = JSON.stringify(await brevoRes.json()); } catch { /* ignore */ }
    console.error("Brevo error", brevoRes.status, detail);
    return json({ error: "Brevo-Fehler", status: brevoRes.status }, 502, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
