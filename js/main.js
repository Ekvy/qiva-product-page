/* QIVA Sculpt — interactions (safe on all pages, incl. legal subpages) */
(function () {
  "use strict";

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
      if (!href || href === "#" || buy.getAttribute("aria-disabled") === "true") {
        e.preventDefault();
        alert("Der Checkout wird in Kürze aktiviert. Folge uns auf @qiva.care für den Launch!");
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
    },
    ch: {
      flag: "🇨🇭",
      label: "Schweiz",
      amount: "CHF" + NBSP + "34,90",
      per: "34,90" + NBSP + "CHF" + NBSP + "/" + NBSP + "100" + NBSP + "ml",
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

  /* ---- Footer year ---- */
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
