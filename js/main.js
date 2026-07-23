/* QIVA Sculpt — interactions (safe on all pages, incl. legal subpages) */
(function () {
  "use strict";

  /* ---- Newsletter bestätigt: Gutscheincode nach dem Double-Opt-In anzeigen ----
     Brevo leitet nach dem Klick auf "Anmeldung bestätigen" mit ?nl=ok hierher.
     Erst dann (nach der Bestätigung) wird der Code QIVA20 sichtbar. */
  (function revealCoupon() {
    if (!/[?&]nl=ok\b/.test(window.location.search)) return;
    const CODE = "QIVA20";
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;" +
      "padding:24px;background:rgba(67,51,46,.55);backdrop-filter:blur(4px);";
    overlay.innerHTML =
      '<div style="max-width:440px;width:100%;background:#f6efe4;border-radius:26px;overflow:hidden;' +
      'box-shadow:0 44px 90px -32px rgba(74,58,52,.6);font-family:Inter,Helvetica,Arial,sans-serif;text-align:center;">' +
        '<div style="background:#43332e;padding:26px;">' +
          '<div style="font-family:\'Bebas Neue\',\'Arial Narrow\',Arial,sans-serif;font-size:34px;letter-spacing:.3em;color:#f6efe4;padding-left:.3em;">QIVA</div>' +
        '</div>' +
        '<div style="padding:34px 30px 8px;">' +
          '<p style="margin:0 0 6px;font-size:12px;letter-spacing:.26em;text-transform:uppercase;color:#6f8a47;font-weight:600;">Anmeldung bestätigt 🌿</p>' +
          '<h2 style="margin:0 0 14px;font-family:\'Bebas Neue\',\'Arial Narrow\',Arial,sans-serif;font-weight:400;font-size:32px;color:#43332e;">Willkommen bei QIVA</h2>' +
          '<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#463830;">Hier ist dein Gutschein für <strong>20 % auf deine erste Bestellung</strong>:</p>' +
        '</div>' +
        '<div style="margin:0 30px 24px;padding:22px;background:#efe6cf;border:2px dashed #6f8a47;border-radius:16px;">' +
          '<div style="font-family:\'Bebas Neue\',\'Arial Narrow\',Arial,sans-serif;font-size:40px;letter-spacing:.16em;color:#43332e;padding-left:.16em;">' + CODE + '</div>' +
        '</div>' +
        '<div style="padding:0 30px 34px;">' +
          '<button type="button" data-nl-close style="cursor:pointer;border:none;border-radius:999px;background:#cdf3a0;' +
          'padding:14px 40px;font-family:\'Bebas Neue\',\'Arial Narrow\',Arial,sans-serif;font-size:18px;letter-spacing:.08em;color:#43332e;">Weiter shoppen</button>' +
        '</div>' +
      '</div>';
    const close = () => {
      overlay.remove();
      const url = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", url);
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target.hasAttribute("data-nl-close")) close();
    });
    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", onEsc); }
    });
    (document.body || document.documentElement).appendChild(overlay);
  })();

  /* ---- Sticky nav shrink on scroll ---- */
  const nav = document.getElementById("nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- Mobile menu ---- */
  const burger = document.getElementById("burger");
  const mobile = document.getElementById("navMobile");
  if (burger && mobile) {
    const toggleMenu = (open) => {
      burger.classList.toggle("is-open", open);
      mobile.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
      mobile.hidden = !open;
    };
    burger.addEventListener("click", () => toggleMenu(!burger.classList.contains("is-open")));
    mobile.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => toggleMenu(false)));
  }

  /* ---- Scroll reveal ---- */
  const reveals = document.querySelectorAll(".reveal");
  if (reveals.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---- "Jetzt kaufen" buttons — all share identical behaviour ----
     Until Stripe is wired up they show a placeholder notice. To go live,
     set the same real href (Stripe Payment Link) on every .js-buy element
     and remove aria-disabled — then they all navigate to checkout. */
  document.querySelectorAll(".js-buy").forEach((buy) => {
    buy.addEventListener("click", (e) => {
      const href = buy.getAttribute("href");
      const disabled = buy.getAttribute("aria-disabled") === "true";
      if (!disabled && href && href !== "#") return; // Schweiz: normal zum Stripe-Checkout
      // Deutschland: kein Checkout -> zum Coming-soon-/Newsletter-Bereich scrollen
      if (href && href.charAt(0) === "#" && href !== "#") return; // Anchor-Scroll zulassen
      e.preventDefault();
      const buySection = document.getElementById("kaufen");
      if (buySection) buySection.scrollIntoView({ behavior: "smooth" });
    });
  });

  /* ---- NEWSLETTER (Double-Opt-In via Brevo, 20% Rabatt) ----
     Sendet die E-Mail an den Brevo-Proxy (Cloudflare Worker). Der Worker meldet
     die Adresse per Double-Opt-In bei Brevo an (Liste "QIVA Newsletter") und
     verschickt die Bestätigungsmail mit dem Code QIVA20. Der API-Key liegt
     ausschließlich im Worker, nie hier im öffentlichen Code.
     -> Nach dem Deploy des Workers hier die URL eintragen: */
  const NEWSLETTER_ENDPOINT = "https://DEINE-WORKER-URL.workers.dev"; // TODO: eintragen

  document.querySelectorAll("form.newsletter").forEach((nlForm) => {
    nlForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = nlForm.querySelector('input[type="email"]');
      if (!email || !email.checkValidity()) { if (email) email.reportValidity(); return; }
      const row = nlForm.querySelector(".newsletter__row");
      const hint = nlForm.querySelector(".newsletter__hint");
      const done = nlForm.querySelector(".newsletter__done");
      const btn = nlForm.querySelector('button[type="submit"]');

      // Ohne konfigurierten Endpoint: nur die Bestätigung zeigen (kein Versand).
      if (NEWSLETTER_ENDPOINT.includes("DEINE-WORKER-URL")) {
        if (row) row.hidden = true;
        if (hint) hint.hidden = true;
        if (done) done.hidden = false;
        return;
      }

      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = "…"; }
      try {
        const res = await fetch(NEWSLETTER_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.value.trim(),
            source: nlForm.dataset.source || "website",
          }),
        });
        if (!res.ok) throw new Error("request failed");
        if (row) row.hidden = true;
        if (hint) hint.hidden = true;
        if (done) done.hidden = false;
      } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || "20 % sichern"; }
        if (hint) {
          hint.hidden = false;
          hint.textContent = "Ups, das hat gerade nicht geklappt. Bitte versuche es später erneut.";
        }
      }
    });
  });

  /* ---- Wirkstoffe: Text per Hover (Desktop) bzw. Tap/Klick (Touch) aufklappen ----
     Hover wird rein über CSS gelöst; hier ergänzen wir Klick + Tastatur, damit
     es auch auf Touch-Geräten und barrierefrei funktioniert. */
  document.querySelectorAll(".actives__grid .active").forEach((card) => {
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-expanded", "false");
    const toggle = () => {
      const open = card.classList.toggle("is-open");
      card.setAttribute("aria-expanded", String(open));
    };
    card.addEventListener("click", toggle);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  });

  /* ---- Länder-/Preis-Auswahl ----
     Beim ersten Besuch erscheint ein Dialog mit der Frage, aus welchem Land
     eingekauft wird. Die Wahl wird gespeichert (localStorage) und passt die
     angezeigte Währung & den Preis an. Über die Navigation jederzeit änderbar. */
  const NBSP = " ";
  const REGIONS = {
    de: {
      flag: "🇩🇪",
      label: "Deutschland",
      amount: "CHF" + NBSP + "27,50",
      per: "27,50" + NBSP + "CHF" + NBSP + "/" + NBSP + "100" + NBSP + "ml",
      buyUrl: null, // in Deutschland noch kein Verkauf -> Coming soon + Newsletter
    },
    ch: {
      flag: "🇨🇭",
      label: "Schweiz",
      amount: "CHF" + NBSP + "34,90",
      per: "34,90" + NBSP + "CHF" + NBSP + "/" + NBSP + "100" + NBSP + "ml",
      buyUrl: "https://buy.stripe.com/00w4gBeBT2NJenceus8Ra00",
    },
  };
  const STORAGE_KEY = "qiva_region";

  const modal = document.getElementById("regionModal");
  if (modal) {
    const card = modal.querySelector(".region-modal__card");
    const backdrop = document.getElementById("regionBackdrop");

    const readStored = () => {
      try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
    };
    const writeStored = (code) => {
      try { localStorage.setItem(STORAGE_KEY, code); } catch (_) {}
    };

    const applyRegion = (code) => {
      const r = REGIONS[code];
      if (!r) return;
      document.querySelectorAll("[data-price]").forEach((el) => { el.textContent = r.amount; });
      document.querySelectorAll("[data-price-per]").forEach((el) => { el.textContent = r.per; });
      document.querySelectorAll("[data-region-flag]").forEach((el) => { el.textContent = r.flag; });
      document.querySelectorAll("[data-region-label]").forEach((el) => { el.textContent = r.label; });
      document.documentElement.setAttribute("data-region", code);

      // Buy-Buttons je nach Region: Schweiz -> Stripe-Checkout, Deutschland -> Coming soon
      document.querySelectorAll(".js-buy").forEach((el) => {
        if (r.buyUrl) {
          el.setAttribute("href", r.buyUrl);
          el.removeAttribute("aria-disabled");
          el.textContent = "Jetzt kaufen";
        } else {
          el.setAttribute("href", "#kaufen");
          el.setAttribute("aria-disabled", "true");
          el.textContent = "Coming soon";
        }
      });
    };

    const openModal = () => {
      modal.hidden = false;
      requestAnimationFrame(() => modal.classList.add("is-open"));
      document.body.style.overflow = "hidden";
    };
    const closeModal = () => {
      modal.classList.remove("is-open");
      document.body.style.overflow = "";
      const onEnd = () => { modal.hidden = true; modal.removeEventListener("transitionend", onEnd); };
      modal.addEventListener("transitionend", onEnd);
    };

    // Auswahl-Buttons im Dialog
    card.querySelectorAll(".region-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn.getAttribute("data-region");
        applyRegion(code);
        writeStored(code);
        closeModal();
      });
    });

    // Land erneut ändern (Navigation)
    document.querySelectorAll(".js-region-switch").forEach((btn) => {
      btn.addEventListener("click", openModal);
    });

    // Schliessen nur erlaubt, wenn bereits ein Land gewählt wurde
    const tryDismiss = () => { if (readStored()) closeModal(); };
    if (backdrop) backdrop.addEventListener("click", tryDismiss);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") tryDismiss(); });

    // Initialzustand
    const stored = readStored();
    if (stored && REGIONS[stored]) {
      applyRegion(stored);
    } else {
      applyRegion("de"); // Standardanzeige, bis gewählt wird
      openModal();
    }
  }

  /* ---- KONTAKTFORMULAR (Kontaktseite) ----
     Ohne Backend: baut aus den Feldern eine mailto-Nachricht an support@ekatlevy.de
     und öffnet die E-Mail-App des Nutzers. Für direkten Versand ohne E-Mail-App an
     einen Formular-Dienst anbinden (Formspree/Brevo/…) und diesen Handler ersetzen. */
  const contactForm = document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!contactForm.checkValidity()) { contactForm.reportValidity(); return; }
      const val = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
      };
      const name = val("cfName");
      const email = val("cfEmail");
      const subject = val("cfSubject") || "Anfrage über das QIVA-Kontaktformular";
      const message = val("cfMessage");
      const body =
        "Name: " + name + "\n" +
        "E-Mail: " + email + "\n\n" +
        message;
      const mailto =
        "mailto:support@ekatlevy.de" +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);
      window.location.href = mailto;
      const done = contactForm.querySelector(".contact-form__done");
      if (done) done.hidden = false;
    });
  }

  /* ---- Footer year ---- */
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
