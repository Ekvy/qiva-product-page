# QIVA Sculpt — Product Page

A static one-page product page for **QIVA Sculpt – Active Sculpt Body Cream**.
The design is harmonized with the **EMBODY** platform (`ekat-platform`) so the product
sits inside the same family: deep-plum + pink-cream surfaces, a violet→pink→blush
gradient, neon lime/purple accents, and Bebas Neue · Inter · Fraunces type. It keeps the
QIVA product photography and uses QIVA's mint/lime wordmark variant as the bridge to
EMBODY's lime accent. No build step, no framework — pure HTML/CSS/JS, ready for GitHub
Pages.

Logos are available in several colorways under `assets/` (`wordmark-*.png`,
`monogram-*.png`): `lime`, `plum`, `cream`, `mint`, `bronze` (champagne gold), `espresso`.
Swap the `src` in `index.html` to rebalance toward the original gold look if preferred.

## Structure

```
index.html         # the page (German copy)
css/styles.css     # all styling + responsive + animations
js/main.js         # nav, mobile menu, scroll-reveal, INCI accordion
assets/            # optimized photos (webp + jpg) and transparent logos
.nojekyll          # tells GitHub Pages to serve files as-is
robots.txt
```

## Local preview

```bash
cd qiva-product-page
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy to GitHub Pages

1. Commit & push to the `Pohlinator/qiva-product-page` repo (remote already uses the
   `github-pohlinator` SSH alias):
   ```bash
   git add -A && git commit -m "Add QIVA Sculpt product page" && git push -u origin main
   ```
2. On GitHub → **Settings → Pages** → *Build and deployment* → Source: **Deploy from a
   branch** → Branch: `main` / `/ (root)` → Save.
3. Live at `https://pohlinator.github.io/qiva-product-page/` after ~1 min.
   (All asset paths are relative, so the project-page subpath works without changes.)

## TODO before launch

### 1. Price
The price is a **placeholder** (`€ 39,90`). Update it in two places in `index.html`
(search for `data-price`) — the hero and the buy card.

### 2. Stripe Buy Button / Payment Link
The buy button is currently a disabled placeholder. In `index.html`, find the block
labelled **`STRIPE BUY BUTTON SLOT`** (in the `#kaufen` section). Two options:

- **Payment Link (simplest):** set the button's `href` to your Stripe payment link and
  remove `aria-disabled="true"`:
  ```html
  <a class="btn btn--gold btn--lg" href="https://buy.stripe.com/your_link">In den Warenkorb</a>
  ```
- **Stripe Buy Button (embed):** paste the snippet from the Stripe Dashboard:
  ```html
  <script async src="https://js.stripe.com/v3/buy-button.js"></script>
  <stripe-buy-button buy-button-id="buy_btn_xxx" publishable-key="pk_live_xxx"></stripe-buy-button>
  ```
  Only the **publishable** key (`pk_…`) appears here — that is safe to expose. Never put
  a secret key (`sk_…`) in this repo.

For international sales, enable in the Stripe Dashboard: **Automatic payment methods**,
**Adaptive Pricing**, and **Stripe Tax**.

### 3. Legal pages
Footer links (Impressum / Datenschutz / AGB / Widerruf) point to `#`. Add real pages
before going live (required in Germany/EU).

## Assets

Source images live in `../QIVA/`. They were optimized via PIL with
`/tmp/qiva/process_assets.py` (downscaled, exported to webp+jpg, logos keyed to
transparent PNGs in bronze/cream/mint). Re-run that script to regenerate.
