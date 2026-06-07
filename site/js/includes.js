/**
 * Injects shared header/footer from /includes/*.html (works on static hosts with HTTP).
 */
(function () {
  async function inject(selector, url) {
    const mount = document.querySelector(selector);
    if (!mount) return;
    try {
      const base = typeof window !== "undefined" && window.SOYPLANETA_BASE ? window.SOYPLANETA_BASE : "";
      const res = await fetch(base + url, { cache: "no-store" });
      if (!res.ok) throw new Error(url + " " + res.status);
      const html = await res.text();
      mount.innerHTML = html;
      mount.dispatchEvent(new CustomEvent("soyplaneta:included", { bubbles: true }));
    } catch (err) {
      console.error("[Soy Planeta] Include failed:", url, err);
      mount.innerHTML =
        '<p style="padding:1rem;background:#fee;color:#900;">Could not load layout partial. Open this site over HTTP(S), not file://</p>';
    }
  }

  window.SoyPlanetaIncludes = {
    async loadAll() {
      await inject("#site-header", "/includes/header.html");
      await inject("#site-footer", "/includes/footer.html");
    },
  };
})();
