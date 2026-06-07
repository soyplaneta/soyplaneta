(function () {
  let impactBannerAnimCancelled = false;

  function setActiveNav() {
    const path = window.location.pathname.replace(/\/+$/, "");
    const segments = path.split("/").filter(Boolean);
    let file = segments.length ? segments[segments.length - 1] : "";
    if (!file.includes(".")) file = "index.html";
    document.querySelectorAll("[data-nav]").forEach((a) => {
      const target = a.getAttribute("href") || "";
      const name = a.getAttribute("data-nav");
      const match =
        (name === "home" && (file === "" || file === "index.html")) ||
        target.endsWith(file);
      a.classList.toggle("is-active", match);
      if (match) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function setupMobileNav() {
    const toggle = document.querySelector("[data-nav-toggle]");
    const panel = document.getElementById("site-nav-panel");
    if (!toggle || !panel) return;

    function close() {
      panel.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    function open() {
      panel.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
    }

    toggle.addEventListener("click", () => {
      if (panel.classList.contains("is-open")) close();
      else open();
    });

    panel.addEventListener("click", (e) => {
      if (e.target.closest("a")) close();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) close();
    });
  }

  function setFooterYear() {
    const el = document.querySelector("[data-year]");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  /** Digits-only parse for localized numbers (e.g. 1,850 → 1850). */
  function parseImpactDigits(str) {
    const n = Number(String(str).replace(/\D/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function setupImpactBannerAnimation() {
    const banner = document.querySelector(".impact-banner");
    const stat = banner?.querySelector(".impact-banner__stat");
    const path = banner?.querySelector(".impact-banner__arc-progress");
    if (!banner || !stat || !path) return;

    function applyFinalArcFromStat() {
      const target = parseImpactDigits(stat.textContent);
      if (!target) return;
      path.style.strokeDasharray = "100 100";
    }

    function runCountAndArc() {
      const target = parseImpactDigits(stat.textContent);
      if (!target) return;

      const finalLabel = stat.textContent.trim();

      stat.textContent = "0";
      path.style.strokeDasharray = "0 100";

      const duration = 1400;
      const t0 = performance.now();

      function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
      }

      function formatCount(n) {
        if (/,/.test(finalLabel)) return Math.round(n).toLocaleString("en-US");
        return String(Math.round(n));
      }

      function frame(now) {
        if (impactBannerAnimCancelled) return;
        const t = Math.min(1, (now - t0) / duration);
        const eased = easeOutCubic(t);
        const n = Math.round(target * eased);
        stat.textContent = formatCount(n);
        path.style.strokeDasharray = `${target > 0 ? (n / target) * 100 : 0} 100`;

        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          stat.textContent = finalLabel;
          path.style.strokeDasharray = "100 100";
        }
      }

      requestAnimationFrame(frame);
    }

    document.addEventListener("soyplaneta:langchange", () => {
      impactBannerAnimCancelled = true;
      applyFinalArcFromStat();
    });

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      applyFinalArcFromStat();
      return;
    }

    impactBannerAnimCancelled = false;
    runCountAndArc();
  }

  async function boot() {
    if (window.SoyPlanetaIncludes) {
      await SoyPlanetaIncludes.loadAll();
    }
    setActiveNav();
    setupMobileNav();
    setFooterYear();
    if (window.SoyPlanetaI18n) {
      await SoyPlanetaI18n.init();
    }
    setActiveNav();
    setupImpactBannerAnimation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    void boot();
  }
})();
