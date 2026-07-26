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
worker's CORS config — use one of them if you want to test the newsletter signup locally.

---

# Newsletter setup (Brevo + Cloudflare Worker)

The signup form on the page is our own markup (`index.html`, two instances: CH and DE). It
does **not** post to Brevo directly — it posts JSON to a small Cloudflare Worker
(`brevo-proxy/worker.js`) which then calls Brevo's API.

```
form (index.html)  ──POST {email, source}──▶  Cloudflare Worker  ──Brevo API──▶  DOI email
                                             (holds BREVO_API_KEY)                    │
        page shows "Danke!"  ◀────────────────────────────────────┐                   │
                                                                  │            user clicks
        ?nl=ok → coupon code shown (js/main.js)  ◀─────────────────┴──── redirect back
```

**Why the worker at all:** GitHub Pages is static, so there is no server to keep a secret on.
Brevo's API key allows reading and exporting the whole contact list — it can never sit in
public page JS. The worker is the smallest possible place to hold it.

We are deliberately *not* using **Brevo → Marketing → Forms**. That would mean Brevo hosts
the form (iframe/embed) with its own styling, and the captcha block in that editor would need
Google reCAPTCHA keys. Our route keeps the page's own design, and spam is handled by a
honeypot field plus double opt-in instead — no Google data transfer, nothing extra to declare
in `datenschutz.html`.

## Part A — Brevo

Do this first; the worker references three IDs from here.

1. **Create the contact list.** *Contacts → Lists → Create a list*, name it
   `QIVA Newsletter`. Open it and read the **list ID** from the URL or the list detail —
   this is `LIST_ID` in `worker.js` (currently `3`).
2. **Create the contact attributes.** *Contacts → Settings → Contact attributes* → add two
   text attributes, `QUELLE` and `RABATTCODE`. The worker sends these with every signup
   (`website-ch` / `website-de` and `QIVA20`), which is how we can tell later which region a
   subscriber came from. **If they don't exist, Brevo rejects the request.**
3. **Create the double-opt-in template.** *Marketing → Templates → Create template → Email
   template*, name it `QIVA — Double-Opt-In Bestätigung`. It must contain the confirmation
   link as the tag `{{ params.DOIurl }}` — without it Brevo does not accept the template as
   a DOI template and the API call fails. Put it on the confirm button, e.g.
   "Anmeldung bestätigen". Save and activate it, then read the **template ID** from the
   template list — this is `DOI_TEMPLATE_ID` in `worker.js` (currently `5`).
4. **Generate the API key.** *Settings → SMTP & API → API Keys → Generate a new API key*.
   Copy it now; Brevo shows it exactly once. This goes into Cloudflare in Part B, **not**
   into this repo.
5. Update `LIST_ID` and `DOI_TEMPLATE_ID` at the top of `brevo-proxy/worker.js` if the IDs
   Brevo assigned differ from the values already in the file.

## Part B — Cloudflare

A free account is enough (no credit card). Workers' free tier is 100k requests/day, which is
far beyond what a newsletter form needs.

**Via the dashboard (no tooling):**

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) → **Compute (Workers)** →
   *Create* → *Start from Hello World* → name it `qiva-newsletter` → **Deploy**.
2. *Edit code* → replace everything with the contents of `brevo-proxy/worker.js` → **Deploy**.
3. *Settings → Variables and Secrets* → **Add** → type **Secret**, name `BREVO_API_KEY`,
   value = the key from Part A step 4 → **Deploy** again.
4. Copy the worker URL (`https://qiva-newsletter.<subdomain>.workers.dev`).

**Via CLI instead**, using the included `brevo-proxy/wrangler.toml`:

```bash
npm install -g wrangler
wrangler login
cd brevo-proxy
wrangler secret put BREVO_API_KEY    # paste the key when prompted
wrangler deploy
```

Then paste the worker URL into **`js/main.js`** as `NEWSLETTER_ENDPOINT` (it still holds the
placeholder `https://DEINE-WORKER-URL.workers.dev`) and commit.

The Cloudflare account is only needed for this worker — DNS for qiva.ch stays wherever it is
today. If DNS *is* moved to Cloudflare later, note the "DNS only / grey cloud" caveat in
step 2 of the go-live checklist below.

## Allowed origins and the confirmation redirect

`worker.js` has one `SITES` map that does double duty: it is the CORS allow-list *and* it
decides where the double-opt-in link sends the user afterwards, based on which site the
signup came from. `qiva.ch`, `www.qiva.ch` and `ekvy.github.io` are all in it, so the
domain switch needs no re-deploy. Requests from any other origin get a 403.

Local signups (`localhost:8080`) are allowed, but their confirmation link points at
`qiva.ch` — Brevo requires a publicly reachable redirect URL.

## Test it end to end

1. `python3 -m http.server 8080` and open `http://localhost:8080` (that exact origin — it is
   in the allow-list).
2. Sign up with a real address you can read. The form should swap to "Danke! Dein 20 %-Code
   ist unterwegs".
3. Check Brevo *Contacts* — the address appears with status **unconfirmed**.
4. Click the confirmation link in the email. It should land on `qiva.ch/?nl=ok#kaufen`, the
   contact flips to **confirmed** and joins the list, and `js/main.js` reveals the `QIVA20`
   coupon.

| Symptom | Cause |
|---|---|
| Console: CORS / 403 | Origin not in `SITES`. Use `localhost:8080`, not `:3000` or a `file://` path |
| Form shows the error hint | Worker returned 502 — check the Brevo detail in the Cloudflare worker logs |
| 500 "BREVO_API_KEY fehlt" | Secret not set, or set as a plain variable instead of a Secret |
| Brevo 400 on the API call | `QUELLE`/`RABATTCODE` attributes missing, or wrong `LIST_ID`/`DOI_TEMPLATE_ID` |
| No email arrives | Template not activated, or `{{ params.DOIurl }}` missing from it |
| Signup silently "succeeds", no contact | The honeypot caught it — the hidden `website` field was filled |

---

# Go-live checklist

The repo is `Ekvy/qiva-product-page`. The account was formerly named `Pohlinator`; GitHub
still redirects the old paths, and the local `github-pohlinator` SSH remote alias keeps
working — it's just a key alias, unrelated to the account name.

## 0. Close the open TODO in the code

Unrelated to DNS, so do it first.

- **`js/main.js`** — `NEWSLETTER_ENDPOINT` is still the placeholder
  `https://DEINE-WORKER-URL.workers.dev`. Work through
  [Newsletter setup](#newsletter-setup-brevo--cloudflare-worker) above, then paste the real
  worker URL here. Until then every newsletter signup silently shows "Danke!" without
  storing anything — which also means the advertised 20 % discount code is never delivered.

Origins and the confirmation redirect are already handled: `worker.js` allows both
`ekvy.github.io` and `qiva.ch` and picks the redirect target from the requesting origin, so
the domain switch needs no worker re-deploy.

## 1. Publish the site

1. Merge the go-live branch into `main` — GitHub Pages serves from `main` / `/ (root)`, so
   the `CNAME` file only takes effect there.
2. **Settings → Pages** → *Build and deployment* → Source: **Deploy from a branch** →
   Branch: `main` / `/ (root)`.
3. **Custom domain** should already read `qiva.ch` (GitHub picks it up from the `CNAME`
   file). If not, enter it and save.

Without a custom domain the site stays at `https://ekvy.github.io/qiva-product-page/`. All
asset paths are relative, so both the subpath and the domain root work unchanged.

## 2. DNS records at the registrar

An apex domain cannot be a CNAME (DNS spec), hence the A/AAAA records. These IPs are
GitHub's and are the same for every account:

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

- **Delete any pre-existing A/AAAA/CNAME records on the apex** — registrars almost always
  park a placeholder page there, and it will conflict.
- **Do not touch MX records** if email runs on qiva.ch.
- Set TTL to 300 s during the switch, raise it again afterwards.
- If DNS is hosted at Cloudflare, set the records to **"DNS only"** (grey cloud). With the
  proxy enabled, GitHub's certificate check fails.
- If the registrar offers `ALIAS`/`ANAME`, a single record pointing at `ekvy.github.io` can
  replace the eight A/AAAA records.

Verify propagation before moving on:

```bash
dig +short qiva.ch A
dig +short www.qiva.ch CNAME
```

## 3. Enable HTTPS

Wait for the green check under Settings → Pages, **then** tick **Enforce HTTPS**. The
Let's Encrypt certificate takes a few minutes up to ~1 h to be issued. Ticking it too early
just errors out — wait and retry.

## 4. Verify the domain (recommended)

github.com/settings/pages → *Add a domain* → add the TXT record it shows:

```
TXT   _github-pages-challenge-ekvy    <value from GitHub>
```

This prevents someone else from claiming qiva.ch on their own GitHub Pages site if the DNS
records are ever left dangling.

## 5. Google Search Console

1. search.google.com/search-console → *Add property* → choose **Domain** (`qiva.ch`), not
   URL prefix. A domain property covers www + non-www and http + https in one go.
2. Verify with the TXT record it hands you, on the apex:
   ```
   TXT   @    google-site-verification=<value from Google>
   ```
3. **Only after the domain resolves and HTTPS is enforced:** *Sitemaps* → submit
   `https://qiva.ch/sitemap.xml`.
4. *URL inspection* → enter `https://qiva.ch/` → **Request indexing**. Speeds up the first
   crawl; the rest follows via the sitemap.

Both TXT records from steps 4 and 5 live on the apex and coexist fine — multiple TXT records
on the same name are normal.

## 6. Check after launch

```bash
curl -sI https://qiva.ch | head -1                    # 200
curl -s https://qiva.ch/robots.txt                    # sitemap line present
curl -sI http://qiva.ch | grep -i location            # redirects to https
curl -sI https://www.qiva.ch | grep -i location       # redirects to apex
```

- Structured data: [Rich Results Test](https://search.google.com/test/rich-results) on
  `https://qiva.ch/` — expect `Product` to be picked up with CHF 27.50.
- Social preview: post the URL in a WhatsApp chat to yourself, or use the
  [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/). Scrapers cache
  aggressively, so re-scrape there after any OG change.
- Run one real Stripe purchase and one newsletter signup end to end.

---

## SEO / structured data in place

- `canonical` on all five pages. The site stays reachable at the `ekvy.github.io` subpath,
  so without these the two URLs would compete as duplicate content.
- Open Graph + Twitter cards with **absolute** image URLs. Relative `og:image` paths are not
  resolved by most scrapers — that was previously broken.
- `lang="de-CH"` throughout.
- `sitemap.xml` with the 5 real page URLs, referenced from `robots.txt`.
- JSON-LD in `index.html`: `Organization`, `WebSite`, `WebPage`, a `SiteNavigationElement`
  list of the page sections, and `Product` with the CHF 27.50 offer (`InStock`,
  `areaServed: CH`). `BreadcrumbList` on the legal and contact pages.

**On section links in search results:** Google **ignores URL fragments in sitemaps** and
folds them onto the parent page, so listing `#wirkung` etc. there does nothing. The
"jump to section" links are generated by Google itself from the page's `id` anchors and
headings; the `SiteNavigationElement` markup is a supporting signal. It cannot be forced.
In-page nav links are also used as a hint — the nav currently links `#wirkung`,
`#wirkstoffe`, `#anwendung` and `#details`, but not `#sommer` or `#kaufen`.

## Known gaps

- **No dedicated OG image.** `og:image` uses the square `assets/brand-gold.jpg`
  (1254×1254). It works, but a 1200×630 landscape image would render better in WhatsApp
  and LinkedIn previews.
- **Germany.** The DE region shows "Coming soon" plus a newsletter signup. Prices,
  shipping and the DE legal wording need a pass before that market opens.

## Assets

Source images live in `../QIVA/`. They were optimized via PIL with
`/tmp/qiva/process_assets.py` (downscaled, exported to webp+jpg, logos keyed to transparent
PNGs in bronze/cream/mint). Re-run that script to regenerate.
