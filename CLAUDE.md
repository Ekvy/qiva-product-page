# QIVA — Produktseite

Statische One-Page-Site für die *QIVA Sculpt* Body Cream, gehostet auf GitHub Pages unter
**https://qiva.ch**. Kein Build-Schritt, kein Framework, keine Abhängigkeiten — reines
HTML/CSS/JS, direkt aus dem Repo-Root ausgeliefert.

Lokal ansehen:

```bash
python3 -m http.server 8080     # http://localhost:8080
```

Genau Port **8080** (oder `127.0.0.1:8080`) verwenden — nur diese Origins stehen in der
CORS-Allow-List des Newsletter-Workers. Unter einem anderen Port schlägt die Anmeldung mit
403 fehl.

---

## Commit-Konvention

Es gibt **keinen** Auto-Commit. Ein früherer `Stop`-Hook in `.claude/settings.json` führte
nach jedem Turn `git add -A && git commit && git push` aus; er wurde entfernt, weil er
ungeprüft alles mitnahm, was im Arbeitsverzeichnis lag. Nicht wieder einführen.

Stattdessen gilt:

- **Am Ende einer abgeschlossenen Aufgabe committen**, nicht nach jedem Einzelschritt.
- Vor `git add` einmal `git status` lesen und prüfen, *was* mitgeht. Kein `git add -A` im
  Blindflug.
- Commit-Message: erste Zeile beschreibt die Wirkung, der Rumpf das *Warum* — vor allem, wenn
  eine überraschende Plattform-Eigenheit der Grund war (davon gibt es hier mehrere).
- **Push deployt live.** `main` ist der Produktions-Branch, GitHub Pages baut binnen ~20 s.
  Es gibt keine Staging-Umgebung. Vor dem Push fragen.

---

## Deployment

| | |
|---|---|
| Hosting | GitHub Pages, Repo `Ekvy/qiva-product-page`, Branch `main`, Ordner `/` |
| Domain | `qiva.ch`, via `CNAME`-Datei im Root |
| HTTPS | Let's Encrypt, *Enforce HTTPS* aktiv |
| Weiterleitungen | `http://` → `https://`, `www.` → Apex, alles auf `https://qiva.ch/` |

Die `CNAME`-Datei wird **auch von GitHub selbst geschrieben**, sobald jemand im UI unter
*Settings → Pages* die Custom Domain ändert. Das erzeugt Commits direkt auf `main` und lässt
das lokale Repo zurückfallen — nach solchen Eingriffen `git pull`, sonst wird der nächste Push
abgelehnt.

`ekvy.github.io/qiva-product-page/` leitet mit 301 auf `qiva.ch` weiter. Diese Origin steht
weiterhin in der Worker-Allow-List und in `canonical`-Tags berücksichtigt.

---

## DNS — Hostpoint, nicht hosttech

Die Domain ist bei **Hostpoint** registriert *und* die Zone wird dort verwaltet. Die
Nameserver zeigten aber lange auf hosttech (`ns1/ns2/ns3.hostserv.eu`) — ein Überbleibsel
eines Registrar-Transfers, denn ein Transfer verschiebt die Domain, nicht die Delegation.
Folge: Die im Hostpoint-Panel gepflegte Zone wurde von niemandem abgefragt, alle Resolver
bekamen weiter hosttechs Parking-IP.

**Falls DNS-Änderungen scheinbar wirkungslos bleiben**, zuerst die Delegation prüfen, nicht
die Records:

```bash
dig +norecurse NS qiva.ch @a.nic.ch     # muss ns/ns2/ns3.hostpoint.ch liefern
dig +short qiva.ch A @ns.hostpoint.ch   # autoritativ, umgeht jeden Cache
```

Ein öffentlicher Resolver taugt hier nicht als Beweis — negative Antworten werden
zwischengespeichert, neue TXT-Records tauchen dort teils Minuten später auf als beim
autoritativen Server.

In der Zone liegen neben den GitHub-A/AAAA-Records auch **MX für Hostpoint-Mail**, ein
SPF-TXT und ein Wildcard `*.qiva.ch → 217.26.48.101`. Explizite Records gewinnen immer über
den Wildcard.

- **MX und den SPF-TXT nie anfassen** — darüber läuft die Geschäftsmail.
- Der SPF nutzt `v=spf1 redirect=spf.mail.hostpoint.ch`. Ein `redirect=`-Modifier schluckt
  alles Nachfolgende; einen `include:` einfach anzuhängen funktioniert **nicht**. Brevo
  braucht hier zum Glück keine SPF-Änderung (eigene Return-Path-Domain).

---

## Newsletter

```
Formular (js/main.js)  ──POST──▶  Cloudflare Worker  ──▶  Brevo Double-Opt-In
                                  (hält den API-Key)
```

Der Worker existiert nur, damit der Brevo-API-Key nicht im öffentlichen Seiten-Code steht.

### Cloudflare Worker

| | |
|---|---|
| Name | `qiva-newsletter` |
| URL | `https://qiva-newsletter.bold-dew-8a6f.workers.dev` |
| Quelle | `brevo-proxy/worker.js`, Config `brevo-proxy/wrangler.toml` |
| Secret | `BREVO_API_KEY` (Typ *Secret*, nicht *Text*) |

Deployen — `wrangler` liegt via `npx` bereit, kein globales Install nötig:

```bash
set -a; source .env; set +a
cd brevo-proxy
npx wrangler deploy
npx wrangler tail                                              # Live-Logs
printf '%s' "$BREVO_API_KEY" | npx wrangler secret put BREVO_API_KEY   # nur bei Key-Wechsel
```

**Rollout-Rennen:** Ein `secret put` erzeugt eine neue Worker-Version. Für etwa eine Minute
bedienen beide Versionen Anfragen, ein Test direkt danach kann noch die alte treffen und
`{"error":"BREVO_API_KEY fehlt"}` liefern. Kein Fehler — abwarten und wiederholen.

Die URL ist zusätzlich in `js/main.js` hinterlegt (`NEWSLETTER_ENDPOINT`). Wird der Worker
umbenannt, muss diese Zeile mit. Solange dort der Platzhalter `DEINE-WORKER-URL` steht, zeigt
das Formular nur „Danke!" und sendet nichts — eine bewusste Schutzabfrage, die die Seite ohne
Worker nicht kaputt aussehen lässt. Die Zeichenkette `DEINE-WORKER-URL` kommt deshalb legitim
noch einmal in der Prüfung selbst vor; ein Treffer beim Grep ist normal.

### Kontaktformular

Läuft über denselben Worker, Route **`/kontakt`**. Der Wurzelpfad bleibt der Newsletter —
absichtlich, damit die schon eingetragene Worker-URL unverändert weiterfunktioniert.

`kontakt.html` → `js/main.js` → `POST <worker>/kontakt` → Brevo `/v3/smtp/email` →
`support@ekatlevy.de`. Vorher baute das Formular nur einen `mailto:`-Link; das scheiterte bei
allen ohne eingerichtetes Mailprogramm, und die Nachricht kam nie an.

**Absender ist `newsletter@qiva.ch`, nicht die Adresse des Besuchers.** Letzteres wäre
naheliegend, würde aber an DMARC scheitern — wir dürfen nicht im Namen fremder Domains senden,
die Mail landete im Spam oder würde abgewiesen. Die Besucheradresse steht in `replyTo`, ein
Klick auf „Antworten" geht also trotzdem direkt an die Person.

Versendet wird nur `textContent`, kein HTML — so kann eine eingesandte Nachricht keine
Markup-Reste in den Posteingang tragen. Felder werden auf Länge begrenzt (Name 100, Betreff
150, Nachricht 5000 Zeichen), das Honeypot-Feld `website` gilt für beide Formulare.

### Brevo

| | |
|---|---|
| Konto | `info@ekatlevy.de`, Free-Plan (300 Mails/Tag) |
| Liste | `QIVA Newsletter` → **ID 4** |
| DOI-Template | **ID 4** |
| Absender | `QIVA <newsletter@qiva.ch>`, Sender-ID 2 |
| Attribute | `QUELLE`, `RABATTCODE` (beide Text, Pflicht) |

**Die wichtigste Falle:** `/contacts/doubleOptinConfirmation` akzeptiert ausschließlich
Brevos eigene **DOI-System-Templates** — jene, mit denen das Konto initial bestückt wird. Ein
von Hand unter *Templates* angelegtes Template wird abgelehnt:

```json
{"code":"invalid_parameter","message":"An active DOI template does not exist"}
```

…und zwar auch dann, wenn es aktiv ist und den korrekten Tag `{{ doubleoptin }}` enthält. Die
DOI-Eigenschaft lässt sich nachträglich **nicht** setzen. Deshalb wurde das QIVA-Design in das
System-Template 4 hineingeschrieben, statt ein neues anzulegen. `DOI_TEMPLATE_ID` niemals auf
ein frisch erstelltes Template zeigen lassen.

Der Bestätigungslink im Template ist `{{ doubleoptin }}` — **nicht** `{{ params.DOIurl }}`.

Die Attribute `QUELLE` und `RABATTCODE` müssen im Konto existieren, sonst quittiert Brevo
jede Anmeldung mit 400.

**Eine Mail, nicht zwei.** Die Opt-In-Mail trägt den Code `QIVA20` direkt. Bewusster
Kompromiss: Der Code geht vor der Bestätigung raus, also auch an Adressen, die nie bestätigen
— dafür braucht der Kunde keine zweite Mail. Es gibt **keine** Mail nach der Bestätigung: Der
DOI-Endpunkt leitet nur auf `redirectionUrl` weiter, Brevos „final confirmation"-Template
feuert dabei nicht, und eine Automation existiert nicht. Die Templates 5 und 6 sind
überholte Entwürfe, deaktiviert und mit `[UNBENUTZT]` präfixiert.

Nach der Bestätigung landet der Nutzer auf `qiva.ch/?nl=ok#kaufen`; `js/main.js` blendet daraus
das Gutschein-Overlay ein.

### Newsletter testen

- **Immer eine frische Adresse.** Liegt für eine Adresse bereits eine DOI-Anfrage vor,
  antwortet Brevo mit `204` statt `201` und verschickt nichts. Der Worker wertet beide als
  Erfolg (damit ein Doppelklick im Formular kein Fehler ist), das Formular zeigt also „Danke!",
  obwohl keine Mail rausging.
- **Die Kontaktliste bleibt bis zur Bestätigung leer.** Brevo legt den Kontakt erst beim Klick
  an. Eine leere Liste direkt nach der Anmeldung ist normal.
- **Maßgeblich ist das Event-Log**, nicht die Kontaktliste: Brevo → *Statistics → Email →
  Logs* bzw. `/smtp/statistics/events?email=…`. Dort stehen `requests`, `delivered`, `opened`,
  `clicks` und der sichtbare Absender.

Ein Fehler im Formular liefert dem Browser bewusst nur ein generisches `{"error":"Brevo-Fehler"}`.
Die Klartext-Meldung von Brevo steht im Worker-Log (`npx wrangler tail`) — oder man wiederholt
den Aufruf direkt gegen `https://api.brevo.com/v3/contacts/doubleOptinConfirmation`.

---

## Secrets

`.env` im Repo-Root, Vorlage `.env.example`. Enthält `BREVO_API_KEY`,
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Ist in `.gitignore` und muss es bleiben.

Werte **nie** mit dem Datei-Tool lesen. Stattdessen in der Shell laden und durchreichen:

```bash
set -a; source .env; set +a
```

**Regel: erst die `.gitignore` erweitern, dann die Datei mit Zugangsdaten anlegen** — und mit
`git check-ignore -v <datei>` gegenprüfen, statt es anzunehmen.

Eine `.gitignore`-Regel für `.env` allein reicht nicht. Editoren legen daneben Swap- und
Backup-Dateien an (`.env.swp`, `.env~`), die den kompletten Klartext enthalten und von der
`.env`-Regel nicht erfasst werden. Die passenden Muster stehen bereits in der `.gitignore` und
gehören dort hin.

Cloudflare-Token: Vorlage *Edit Cloudflare Workers*, Account-Scope. Kein Global API Key.
Client-IP-Filter leer lassen — bei dynamischer IP sperrt er das Token sonst kommentarlos aus.

Brevo- und Cloudflare-Zugangsdaten lassen sich **nicht** per API erzeugen; beide müssen im
jeweiligen Dashboard geklickt werden.

---

## Dateien

```
index.html          Startseite (Produkt, Newsletter-Formular, Kauf-Sektion)
impressum.html  datenschutz.html  agb.html  kontakt.html
css/styles.css
js/main.js          Newsletter-Anbindung, Gutschein-Overlay, UI
brevo-proxy/        Cloudflare Worker (worker.js, wrangler.toml)
CNAME               qiva.ch — von GitHub Pages mitverwaltet
robots.txt  sitemap.xml
README.md           Go-live-Ablauf Schritt 1–10 mit Status
```

`datenschutz.html` beschreibt den tatsächlichen Datenfluss (Brevo als Auftragsverarbeiter,
Double-Opt-In, Cloudflare-Proxy). Änderungen an der Newsletter-Mechanik müssen dort
nachgezogen werden — der Text ist **nicht** juristisch geprüft.

---

## Offen

- **Weiterleitung `newsletter@qiva.ch` bei Hostpoint.** Nicht mehr dringend: `replyTo` steht in
  Template 4 auf `info@ekatlevy.de`, Antworten kommen also an. Offen bleiben nur Bounce- und
  Fehlermeldungen fremder Mailserver — die gehen an die Absenderadresse, nicht an `replyTo`,
  und werden verworfen, solange das Postfach nicht existiert. Eine Weiterleitung genügt, ein
  eigenes Postfach ist nicht nötig.
- **Stripe-Testkauf** von der Live-Domain (README Schritt 8): CHF 27.50, CH-Versandoption,
  Bestätigungsmail.
- **Google Search Console** (Schritt 9): Domain-Property, Verifikations-TXT, Sitemap
  einreichen.
- **Schlusschecks** (Schritt 10): Rich Results Test, Social-Preview.
- **Nach dem 31.08.2026:** Versand-Promo-Leiste in `index.html` und die Launch-Aktion-Klausel
  in `agb.html` entfernen.
