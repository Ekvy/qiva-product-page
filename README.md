# QIVA Sculpt — Product Page

A static one-page product page for **QIVA Sculpt – Active Sculpt Body Cream**, plus the
legal pages required for selling in CH/EU. No build step, no framework — pure HTML/CSS/JS,
served by GitHub Pages.

The design is harmonized with the **EMBODY** platform (`ekat-platform`) so the product sits
inside the same family: deep-plum + pink-cream surfaces, a violet→pink→blush gradient, neon
lime/purple accents, and Bebas Neue · Inter · Fraunces type.

Logos are available in several colorways under `assets/` (`wordmark-*.png`,
`monogram-*.png`): `lime`, `plum`, `cream`, `mint`, `bronze` (champagne gold), `espresso`.
The page currently uses `wordmark-bronze` in the nav and `wordmark-mint` in the footer/body.

**Launch market is Switzerland.** The price is CHF 27.50 and checkout runs through a Stripe
payment link. Germany is not live yet — visitors who pick 🇩🇪 see a "Coming soon" panel with
a newsletter signup instead of a buy button.

## Structure

```
index.html          # the product page (German copy)
impressum.html      # legal pages, linked from the footer
datenschutz.html
agb.html
kontakt.html        # contact form (mailto-based, no backend)
css/styles.css      # all styling + responsive + animations
js/main.js          # nav, mobile menu, scroll-reveal, INCI accordion,
                    # region switch (DE/CH), newsletter, contact form
brevo-proxy/        # Cloudflare Worker: newsletter double-opt-in via Brevo
                    # worker.js + wrangler.toml (only needed for CLI deploys)
assets/             # optimized photos (webp + jpg) and transparent logos
CNAME               # custom domain for GitHub Pages -> qiva.ch
sitemap.xml         # 5 page URLs, submitted to Google Search Console
robots.txt          # allow-all + sitemap reference
.nojekyll           # tells GitHub Pages to serve files as-is
```

## Local preview

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Any port works, but `8080` and `127.0.0.1:8080` are the origins allow-listed in the Brevo
worker's CORS config — use one of them to test the newsletter signup locally.

---

# Go live — do these in order

Status on **2026-07-26**: the go-live branch is merged into `main` and pushed, so GitHub
Pages now serves the new version and has picked up `qiva.ch` from the `CNAME` file.

> ⚠️ **The page is currently unreachable.** `ekvy.github.io/qiva-product-page/` 301-redirects
> to `qiva.ch`, and that domain still resolves to the hosttech parking page. **Step 1 fixes
> this** — until it is done, nobody can reach the site.

Steps 1–3 bring the site back online. Steps 4–7 make the newsletter work. Steps 8–10 are
launch verification. Do them in this order; each one depends on the previous.

## 1. DNS at hosttech

The domain is registered at hosttech (`qiva.ch` → `185.101.158.113` = `default.hosttech.eu`).
Open the DNS editor there and set:

```
A     @      185.199.108.153
A     @      185.199.109.153
A     @      185.199.110.153
A     @      185.199.111.153
AAAA  @      2606:50c0:8000::153
AAAA  @      2606:50c0:8001::153
AAAA  @      2606:50c0:8002::153
AAAA  @      2606:50c0:8003::153
CNAME www    ekvy.github.io.
```

- **Delete the existing A record on the apex first** (`185.101.158.113`) — it is hosttech's
  parking page and will conflict.
- **Do not touch MX records** if email runs on qiva.ch.
- Set TTL to 300 s during the switch, raise it again afterwards.
- If hosttech offers `ALIAS`/`ANAME`, one record pointing at `ekvy.github.io` can replace the
  eight A/AAAA records.

An apex domain cannot be a CNAME (DNS spec), hence the A/AAAA records. Those IPs are
GitHub's and identical for every account. Verify before moving on:

```bash
dig +short qiva.ch A          # expect the four 185.199.x.153 addresses
dig +short www.qiva.ch CNAME  # expect ekvy.github.io.
```

## 2. Enable HTTPS

Repo → **Settings → Pages**. Wait for the green check on the custom domain, **then** tick
**Enforce HTTPS**. The Let's Encrypt certificate takes a few minutes up to ~1 h. Ticking it
too early just errors out — wait and retry.

While you are there, confirm *Build and deployment* → Source is **Deploy from a branch**,
branch `main` / `/ (root)`.

## 3. Verify the domain on GitHub

github.com/settings/pages → *Add a domain* → add the TXT record it shows:

```
TXT   _github-pages-challenge-ekvy    <value from GitHub>
```

This stops anyone else from claiming qiva.ch on their own Pages site if the DNS records are
ever left dangling.

## 4. Set up Brevo

Free account at [brevo.com](https://www.brevo.com). Four things, in this order — the worker
references three IDs from here.

1. **Contact list.** *Contacts → Lists → Create a list*, name it `QIVA Newsletter`. Note the
   **list ID**.
2. **Contact attributes.** *Contacts → Settings → Contact attributes* → add two text
   attributes, `QUELLE` and `RABATTCODE`. The worker sends these with every signup
   (`website-ch` / `website-de` and `QIVA20`), which is how we can tell later which region a
   subscriber came from. **If they don't exist, Brevo rejects the request.**
3. **Double-opt-in template.** *Marketing → Templates → Create template → Email template*,
   name it `QIVA — Double-Opt-In Bestätigung`. It **must** contain the confirmation link as
   the tag `{{ params.DOIurl }}` — put it on the confirm button ("Anmeldung bestätigen").
   Without that tag Brevo does not accept it as a DOI template and the API call fails. Save
   and activate, then note the **template ID**.
4. **API key.** *Settings → SMTP & API → API Keys → Generate a new API key*. Copy it now —
   Brevo shows it exactly once. It goes into Cloudflare in step 5, **never** into this repo.

Then open `brevo-proxy/worker.js` and correct the two IDs at the top if they differ from what
Brevo assigned:

```js
const LIST_ID = 3;          // <- your list ID from 4.1
const DOI_TEMPLATE_ID = 5;  // <- your template ID from 4.3
```

## 5. Deploy the Cloudflare Worker

Free account at [dash.cloudflare.com](https://dash.cloudflare.com), no credit card. The
Workers free tier is 100k requests/day, far beyond what a signup form needs. This account is
**only** for the worker — DNS stays at hosttech.

**Via the dashboard:**

1. **Compute (Workers)** → *Create* → *Start from Hello World* → name it `qiva-newsletter` →
   **Deploy**.
2. *Edit code* → replace everything with the contents of `brevo-proxy/worker.js` → **Deploy**.
3. *Settings → Variables and Secrets* → **Add** → type **Secret**, name `BREVO_API_KEY`,
   value = the key from step 4.4 → **Deploy** again.
4. Copy the worker URL (`https://qiva-newsletter.<subdomain>.workers.dev`).

**Or via CLI**, using the included `brevo-proxy/wrangler.toml`:

```bash
npm install -g wrangler
wrangler login
cd brevo-proxy
wrangler secret put BREVO_API_KEY    # paste the key when prompted
wrangler deploy
```

## 6. Connect the page to the worker

Paste the worker URL into `js/main.js` — it still holds a placeholder:

```js
const NEWSLETTER_ENDPOINT = "https://DEINE-WORKER-URL.workers.dev"; // <- replace
```

Commit and push to `main`. Until this is done, every signup shows "Danke!" and stores
nothing — which means the 20 % discount code advertised on the page is never delivered.

## 7. Test the newsletter end to end

1. `python3 -m http.server 8080`, open `http://localhost:8080` (that exact origin — it is in
   the worker's allow-list).
2. Sign up with a real address you can read. The form should swap to "Danke! Dein 20 %-Code
   ist unterwegs".
3. Brevo *Contacts* → the address appears as **unconfirmed**.
4. Click the confirmation link in the email → it lands on `qiva.ch/?nl=ok#kaufen`, the contact
   flips to **confirmed** and joins the list, and the `QIVA20` coupon overlay appears.

If something fails, see [Newsletter troubleshooting](#newsletter-troubleshooting) below.

## 8. Test a real Stripe purchase

The payment link is wired into `index.html` and `js/main.js` but has never been run from the
live domain. Buy one unit and confirm CHF 27.50, the CH shipping option, and the confirmation
email.

## 9. Google Search Console

1. [search.google.com/search-console](https://search.google.com/search-console) → *Add
   property* → choose **Domain** (`qiva.ch`), not URL prefix. A domain property covers
   www + non-www and http + https in one go.
2. Verify with the TXT record it hands you, on the apex:
   ```
   TXT   @    google-site-verification=<value from Google>
   ```
   This coexists fine with the GitHub TXT record from step 3 — multiple TXT records on the
   same name are normal.
3. *Sitemaps* → submit `https://qiva.ch/sitemap.xml`.
4. *URL inspection* → `https://qiva.ch/` → **Request indexing**. Speeds up the first crawl;
   the rest follows via the sitemap.

## 10. Final checks

```bash
curl -sI https://qiva.ch | head -1                    # 200
curl -s  https://qiva.ch/robots.txt                   # sitemap line present
curl -sI http://qiva.ch | grep -i location            # redirects to https
curl -sI https://www.qiva.ch | grep -i location       # redirects to apex
```

- Structured data: [Rich Results Test](https://search.google.com/test/rich-results) on
  `https://qiva.ch/` — expect `Product` with CHF 27.50.
- Social preview: post the URL in a WhatsApp chat to yourself, or use the
  [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/). Scrapers cache
  aggressively, so re-scrape after any OG change.

## Not blocking, but on the list

- **Get `datenschutz.html` reviewed.** Section 8 names Brevo as the newsletter processor and
  describes the double-opt-in flow and the Cloudflare proxy; section 11 lists both, section 12
  gained France. Written to match the actual data flow, but it is legal text and has **not**
  been reviewed by a lawyer — check the exact Brevo contracting entity against your own
  AV-Vertrag.
- **After 31 August 2026:** remove the "Bis Ende August gratis Versand" promo bar and
  buy-section note in `index.html`, and the matching Launch-Aktion clause in `agb.html`.

---

# Reference

## How the newsletter works

The signup form is our own markup (`index.html`, two instances: CH and DE). It does **not**
post to Brevo directly — it posts JSON to a small Cloudflare Worker (`brevo-proxy/worker.js`)
which then calls Brevo's API.

```
form (index.html)  ──POST {email, source}──▶  Cloudflare Worker  ──Brevo API──▶  DOI email
                                             (holds BREVO_API_KEY)                    │
        page shows "Danke!"  ◀────────────────────────────────────┐                   │
                                                                  │            user clicks
        ?nl=ok → coupon code shown (js/main.js)  ◀─────────────────┴──── redirect back
```

**Why a worker:** GitHub Pages is static, so there is no server to keep a secret on. Brevo's
API key can read and export the whole contact list — it can never sit in public page JS. The
worker is the smallest possible place to hold it.

**Why not Brevo → Marketing → Forms:** that would let Brevo host the form (iframe/embed) with
its own styling, and the captcha block in that editor would need Google reCAPTCHA keys. Our
route keeps the page's design, and spam is handled by a honeypot field plus double opt-in —
no Google data transfer, nothing extra to declare in `datenschutz.html`.

**Origins and the confirmation redirect:** `worker.js` has one `SITES` map that is both the
CORS allow-list *and* the source of the post-confirmation redirect target, picked from the
origin the signup came from. `qiva.ch`, `www.qiva.ch` and `ekvy.github.io` are all in it, so
the domain switch needs no re-deploy. Any other origin gets a 403. Local signups from
`localhost:8080` are allowed but their confirmation link points at `qiva.ch`, because Brevo
requires a publicly reachable redirect URL.

## Newsletter troubleshooting

| Symptom | Cause |
|---|---|
| Console: CORS / 403 | Origin not in `SITES`. Use `localhost:8080`, not `:3000` or a `file://` path |
| Form shows the error hint | Worker returned 502 — check the Brevo detail in the Cloudflare worker logs |
| 500 "BREVO_API_KEY fehlt" | Secret not set, or set as a plain variable instead of a Secret |
| Brevo 400 on the API call | `QUELLE`/`RABATTCODE` attributes missing, or wrong `LIST_ID`/`DOI_TEMPLATE_ID` |
| No email arrives | Template not activated, or `{{ params.DOIurl }}` missing from it |
| Signup silently "succeeds", no contact | The honeypot caught it — the hidden `website` field was filled |

## SEO / structured data in place

- `canonical` on all five pages. The site stays reachable at the `ekvy.github.io` subpath, so
  without these the two URLs would compete as duplicate content.
- Open Graph + Twitter cards with **absolute** image URLs. Relative `og:image` paths are not
  resolved by most scrapers — that was previously broken.
- `lang="de-CH"` throughout.
- `sitemap.xml` with the 5 real page URLs, referenced from `robots.txt`.
- JSON-LD in `index.html`: `Organization`, `WebSite`, `WebPage`, a `SiteNavigationElement`
  list of the page sections, and `Product` with the CHF 27.50 offer (`InStock`,
  `areaServed: CH`). `BreadcrumbList` on the legal and contact pages.

**On section links in search results:** Google **ignores URL fragments in sitemaps** and folds
them onto the parent page, so listing `#wirkung` etc. there does nothing. The "jump to
section" links are generated by Google itself from the page's `id` anchors and headings; the
`SiteNavigationElement` markup is a supporting signal. It cannot be forced. In-page nav links
are also used as a hint — the nav currently links `#wirkung`, `#wirkstoffe`, `#anwendung` and
`#details`, but not `#sommer` or `#kaufen`.

## Known gaps

- **Contact form is `mailto:`-based.** It opens the visitor's mail app, which silently does
  nothing for people on webmail without a configured handler. Fine for launch, worth
  replacing with a real endpoint later.
- **No dedicated OG image.** `og:image` uses the square `assets/brand-gold.jpg` (1254×1254).
  It works, but a 1200×630 landscape image renders better in WhatsApp and LinkedIn previews.
- **Germany.** The DE region shows "Coming soon" plus a newsletter signup. Prices, shipping
  and the DE legal wording need a pass before that market opens.

## Repo notes

The repo is `Ekvy/qiva-product-page`. The account was formerly named `Pohlinator`; GitHub
still redirects the old paths, and the local `github-pohlinator` SSH remote alias keeps
working — it's just a key alias, unrelated to the account name.

Source images live in `../QIVA/`. They were optimized via PIL with
`/tmp/qiva/process_assets.py` (downscaled, exported to webp+jpg, logos keyed to transparent
PNGs in bronze/cream/mint). Re-run that script to regenerate.
