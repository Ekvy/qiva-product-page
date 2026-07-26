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

# Go-live checklist

The repo is `Ekvy/qiva-product-page`. The account was formerly named `Pohlinator`; GitHub
still redirects the old paths, and the local `github-pohlinator` SSH remote alias keeps
working — it's just a key alias, unrelated to the account name.

## 0. Close the open TODOs in the code

These two must be done or the newsletter silently breaks. Both are unrelated to DNS, so do
them first.

- **`js/main.js`** — `NEWSLETTER_ENDPOINT` is still the placeholder
  `https://DEINE-WORKER-URL.workers.dev`. Deploy the worker in `brevo-proxy/` (deploy steps
  are in the file header) and paste its real URL here. Until then every newsletter signup
  fails — which also means the advertised 20 % discount code can't be delivered.
- **`brevo-proxy/worker.js`** — `REDIRECT_URL` and `ALLOWED_ORIGINS` both point at
  `ekvy.github.io`. After the domain switch, requests from `https://qiva.ch` get rejected by
  CORS and the double-opt-in confirmation redirects to the old URL. Update to:
  ```js
  const REDIRECT_URL = "https://qiva.ch/?nl=ok#kaufen";
  const ALLOWED_ORIGINS = [
    "https://qiva.ch",
    "https://www.qiva.ch",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
  ];
  ```
  Re-deploy the worker after editing.

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
