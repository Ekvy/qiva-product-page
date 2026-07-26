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

Status on **2026-07-26**: **steps 1–6 are done.** `https://qiva.ch` is live on GitHub Pages
with a valid Let's Encrypt certificate, Brevo is configured, and the Cloudflare worker is
deployed and wired into the page. What is left: the end-to-end newsletter test (step 7),
Stripe (step 8), Search Console (step 9) and the final checks (step 10).

Steps 1–3 brought the site online. Steps 4–6 make the newsletter work. Steps 7–10 are
verification. Each step depends on the previous.

## 1. DNS at Hostpoint — done

The domain is **registered at Hostpoint**, but its nameservers used to point at hosttech
(`ns1/ns2/ns3.hostserv.eu`), left over from a registrar transfer. A transfer moves the domain
but not the delegation, so the zone edited in the Hostpoint panel was never asked — every
resolver kept getting hosttech's parking IP `185.101.158.113`.

The fix was *Domains → Nameserver → **Hostpoint Nameserver verwenden***, which switched the
`.ch` delegation to `ns/ns2/ns3.hostpoint.ch`. Only then did the records below take effect.
Note this also moved mail: the MX now points at `mx1/mx2.mail.hostpoint.ch` instead of
hosttech.

The records in the Hostpoint DNS editor:

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

- **Do not touch MX or the SPF TXT record** — mail for qiva.ch runs on Hostpoint.
- TTL 300 s is fine to leave as is.
- The zone also carries a wildcard `*.qiva.ch → 217.26.48.101`. Explicit records always win
  over it, so the entries above and the Brevo records in step 4 are unaffected.

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

## 4. Set up Brevo — done

Account `info@ekatlevy.de`, free plan. What is configured:

1. **Contact list** `QIVA Newsletter` — **ID 4**.
2. **Contact attributes** `QUELLE` and `RABATTCODE`, both text. The worker sends these with
   every signup (`website-ch` / `website-de` and `QIVA20`), which is how we can tell later
   which region a subscriber came from. **If they don't exist, Brevo rejects the request.**
3. **Double-opt-in template** — **ID 4**, active. The confirm button carries the tag
   `{{ doubleoptin }}`, *not* `{{ params.DOIurl }}` as an earlier version of this README
   claimed.

   **Why ID 4 and not a hand-made template:** `/contacts/doubleOptinConfirmation` only
   accepts Brevo's own DOI *system* templates — the ones the account is seeded with. A
   template created by hand under *Templates* is rejected with
   `{"code":"invalid_parameter","message":"An active DOI template does not exist"}`, even
   when it is active and contains the right tag. That flag cannot be set after the fact, so
   the QIVA design was moved **into** template 4 instead. Never point `DOI_TEMPLATE_ID` at a
   freshly created template.

4. **One email, not two.** The opt-in mail carries the `QIVA20` code directly. Trade-off,
   decided deliberately: the code goes out before anyone confirms, so unconfirmed addresses
   get it too — in exchange the customer needs no second mail to reach the discount.
   Templates 5 and 6 are the superseded drafts, both deactivated and prefixed `[UNBENUTZT]`.
   There is deliberately **no** post-confirmation mail: the DOI API only redirects to
   `redirectionUrl`, it does not trigger Brevo's "final confirmation" template, and no
   automation exists.
5. **Sender** `newsletter@qiva.ch` (display name `QIVA`), used by template 4.
6. **Domain authentication** for `qiva.ch` — DKIM, DMARC and the verification code are all
   green, so mail is signed and does not get treated as spoofed. The records live in the
   Hostpoint zone:
   ```
   CNAME  brevo1._domainkey   b1.qiva-ch.dkim.brevo.com
   CNAME  brevo2._domainkey   b2.qiva-ch.dkim.brevo.com
   TXT    @                   brevo-code:<verification value>
   TXT    _dmarc              v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com
   ```
   Brevo needs **no SPF change** here — it uses its own return-path domain. Lucky, because
   the existing `v=spf1 redirect=spf.mail.hostpoint.ch` swallows anything appended after the
   `redirect=` modifier.

**Still open:** `newsletter@qiva.ch` has no mailbox or alias at Hostpoint. Sending works
without one (that runs on DKIM), but `replyTo` resolves to the sender address, so replies and
bounces are currently lost. An alias onto an existing mailbox is enough.

The API key is created manually — *Settings → SMTP & API → API Keys*. Brevo has no endpoint
that issues API keys, by design. It goes into Cloudflare in step 5, **never** into this repo.

The IDs above are already set in `brevo-proxy/worker.js`:

```js
const LIST_ID = 4;
const DOI_TEMPLATE_ID = 5;
```

## 5. Deploy the Cloudflare Worker — done

Deployed as `qiva-newsletter` on the free tier (100k requests/day, no credit card). This
Cloudflare account is **only** for the worker — DNS stays at Hostpoint.

```
https://qiva-newsletter.bold-dew-8a6f.workers.dev
```

`BREVO_API_KEY` is set as a Worker **secret**, not a plain variable, so it is write-only in
the dashboard and never appears in the page source.

**Redeploying** — copy `.env.example` to `.env` and fill in `CLOUDFLARE_API_TOKEN` (dashboard
→ API Tokens → template *Edit Cloudflare Workers*), `CLOUDFLARE_ACCOUNT_ID` and
`BREVO_API_KEY`. `.env` is gitignored and must stay that way.

```bash
set -a; source .env; set +a
cd brevo-proxy
npx wrangler deploy
printf '%s' "$BREVO_API_KEY" | npx wrangler secret put BREVO_API_KEY   # only when it changes
npx wrangler tail                                                      # live logs
```

Setting a secret rolls out a new version. For a minute or so both versions serve traffic, so
a request right after `secret put` can still hit the old one and answer
`{"error":"BREVO_API_KEY fehlt"}`. Wait and retry before assuming it is broken.

Alternatively via the dashboard: **Workers & Pages** → *Create application* → *Start with
Hello World!* → name `qiva-newsletter` → *Edit code*, paste `brevo-proxy/worker.js` → deploy
→ *Settings → Variables and Secrets* → add `BREVO_API_KEY` as type **Secret**.

## 6. Connect the page to the worker — done

`js/main.js` points at the worker:

```js
const NEWSLETTER_ENDPOINT = "https://qiva-newsletter.bold-dew-8a6f.workers.dev";
```

The page has a guard: while the placeholder `DEINE-WORKER-URL` is in there, a signup only
shows "Danke!" and sends nothing — so the site never looks broken, but the 20 % code is never
delivered either. Changing the worker name or subdomain means updating this line too.

The worker only answers requests whose `Origin` is in its allow-list (`qiva.ch`,
`www.qiva.ch`, `ekvy.github.io`, `localhost:8080`, `127.0.0.1:8080`). Everything else gets a
403, so the endpoint cannot be abused from other sites.

## 7. Test the newsletter end to end — done

Verified on 2026-07-26 with a real address: mail requested, delivered, opened, confirm link
clicked, contact created with `DOUBLE_OPT-IN: 1` and `listIds: [4]`, sender `newsletter@qiva.ch`.

To repeat it:

1. `python3 -m http.server 8080`, open `http://localhost:8080` (that exact origin — it is in
   the worker's allow-list). Or use the live site, but hard-reload first.
2. Sign up with a **fresh** address. The form swaps to "Danke! Dein 20 %-Code ist unterwegs".
3. Click the confirm button in the mail → lands on `qiva.ch/?nl=ok#kaufen`, the contact is
   created and joins list 4, and the `QIVA20` overlay appears.

Two traps when re-testing:

- **A reused address sends nothing.** With a DOI request already pending, Brevo answers `204`
  instead of `201` and skips the mail. The worker treats both as success (so a double click on
  the form is not an error), so the browser still shows "Danke!". Always test with an address
  that has never been used.
- **Contacts stay empty until confirmation.** Brevo creates the contact on the click, not on
  the signup — an empty contact list right after signing up is normal, not a failure.

The authoritative check is the event log, not the contact list: Brevo → *Statistics →
Email → Logs*, or via API `/smtp/statistics/events?email=…`. It shows `requests`,
`delivered`, `opened`, `clicks` per message, plus the visible sender.

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
| 500 "BREVO_API_KEY fehlt" | Secret not set or set as a plain variable — or a new version is still rolling out right after `secret put`; retry after a minute |
| Brevo 400 on the API call | `QUELLE`/`RABATTCODE` attributes missing, or wrong `LIST_ID`/`DOI_TEMPLATE_ID` |
| No email arrives | Template not activated, or `{{ doubleoptin }}` missing from it |
| Mail lands in spam | Check Brevo → *Senders, Domains & Dedicated IPs* — the qiva.ch DKIM/DMARC records must still be green |
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
