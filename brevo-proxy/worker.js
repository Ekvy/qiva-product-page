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
// Achtung: Brevo akzeptiert hier nur seine eigenen DOI-System-Templates. Ein
// normal angelegtes Transaktions-Template wird mit
// {"code":"invalid_parameter","message":"An active DOI template does not exist"}
// abgelehnt, selbst wenn es {{ doubleoptin }} enthält. Template 4 ist Brevos
// automatisch erzeugtes DOI-Template, inhaltlich auf QIVA umgebaut.
const DOI_TEMPLATE_ID = 4;  // Brevo-Template "QIVA — Double-Opt-In Bestätigung"
const DISCOUNT_CODE = "QIVA20";

// --- Kontaktformular -------------------------------------------------------
// Empfaenger der Anfragen von kontakt.html. Dieselbe Adresse, die auch im
// Impressum und auf der Kontaktseite steht.
const CONTACT_TO = "support@ekatlevy.de";
// Absender MUSS eine Adresse unserer authentifizierten Domain sein. Die Adresse
// aus dem Formular hier einzusetzen waere naheliegend, wuerde aber an DMARC
// scheitern -- wir duerfen nicht im Namen fremder Domains senden, die Mail
// landete im Spam. Die Besucheradresse kommt stattdessen in replyTo: Ein Klick
// auf "Antworten" geht damit direkt an die Person.
const CONTACT_FROM = { name: "QIVA Kontaktformular", email: "newsletter@qiva.ch" };

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
    // Wir antworten mit ok, damit der Bot den Filter nicht bemerkt. Gilt für
    // beide Formulare.
    if (String(body.website || "").trim() !== "") {
      return json({ ok: true }, 200, cors);
    }

    // Route: /kontakt = Kontaktformular, alles andere = Newsletter. Der
    // Newsletter liegt bewusst auf dem Wurzelpfad, damit die bereits in
    // js/main.js eingetragene Worker-URL unverändert weiter funktioniert.
    const path = new URL(request.url).pathname.replace(/\/+$/, "");
    if (path === "/kontakt") {
      return handleContact(body, env, cors);
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

/**
 * Kontaktformular: verschickt den Formularinhalt als Transaktionsmail an
 * CONTACT_TO. Bewusst nur textContent -- ohne HTML kann eine Nachricht keine
 * Markup-Reste in unseren Posteingang tragen.
 */
async function handleContact(body, env, cors) {
  const clip = (v, max) => String(v || "").trim().slice(0, max);

  const name = clip(body.name, 100);
  const email = clip(body.email, 200).toLowerCase();
  const subject = clip(body.subject, 150) || "Anfrage über das QIVA-Kontaktformular";
  const message = clip(body.message, 5000);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: "Ungültige E-Mail-Adresse" }, 400, cors);
  }
  if (message.length < 2) {
    return json({ error: "Nachricht fehlt" }, 400, cors);
  }

  const text =
    "Neue Anfrage über das Kontaktformular auf qiva.ch\n" +
    "------------------------------------------------\n\n" +
    "Name:    " + (name || "(nicht angegeben)") + "\n" +
    "E-Mail:  " + email + "\n" +
    "Betreff: " + subject + "\n\n" +
    "Nachricht:\n" + message + "\n";

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env.BREVO_API_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender: CONTACT_FROM,
      to: [{ email: CONTACT_TO }],
      replyTo: name ? { email, name } : { email },
      subject: "[QIVA Kontakt] " + subject,
      textContent: text,
    }),
  });

  if (res.status === 201) {
    return json({ ok: true }, 200, cors);
  }

  let detail = "";
  try { detail = JSON.stringify(await res.json()); } catch { /* ignore */ }
  console.error("Brevo contact error", res.status, detail);
  return json({ error: "Versand fehlgeschlagen", status: res.status }, 502, cors);
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
