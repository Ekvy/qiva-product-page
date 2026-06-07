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

  /* ---- Footer year ---- */
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
