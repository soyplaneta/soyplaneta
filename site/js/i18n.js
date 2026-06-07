/**
 * Lightweight i18n: loads /content/{lang}.json and fills [data-i18n] elements.
 * Language persists in localStorage; default is browser language or Spanish.
 */
(function () {
  const STORAGE_KEY = "soyplaneta_lang";

  function getPath(obj, path) {
    return path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
  }

  function setLangAttribute(lang) {
    document.documentElement.lang = lang === "en" ? "en" : "es";
  }

  function applyStrings(dict) {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const val = getPath(dict, key);
      if (val !== null && val !== undefined) {
        el.textContent = val;
      }
    });

    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      const val = getPath(dict, key);
      if (val !== null && val !== undefined) {
        el.innerHTML = val;
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const val = getPath(dict, key);
      if (val !== null && val !== undefined) {
        el.setAttribute("placeholder", val);
      }
    });

    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      const val = getPath(dict, key);
      if (val !== null && val !== undefined) {
        el.setAttribute("aria-label", val);
      }
    });
  }

  function updateLangButtons(active) {
    document.querySelectorAll("[data-set-lang]").forEach((btn) => {
      const lang = btn.getAttribute("data-set-lang");
      const isActive = lang === active;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  async function loadDict(lang) {
    const base = typeof window !== "undefined" && window.SOYPLANETA_BASE ? window.SOYPLANETA_BASE : "";
    const res = await fetch(`${base}/content/${lang}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load " + lang);
    return res.json();
  }

  async function setLanguage(lang, dictCache) {
    const langNorm = lang === "en" ? "en" : "es";
    setLangAttribute(langNorm);
    localStorage.setItem(STORAGE_KEY, langNorm);

    let dict = dictCache;
    if (!dict) {
      dict = await loadDict(langNorm);
    }
    applyStrings(dict);
    updateLangButtons(langNorm);

    document.dispatchEvent(
      new CustomEvent("soyplaneta:langchange", { detail: { lang: langNorm, dict } })
    );
    return dict;
  }

  function guessDefaultLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "es") return stored;
    const nav = navigator.language || "";
    return nav.toLowerCase().startsWith("en") ? "en" : "es";
  }

  window.SoyPlanetaI18n = {
    init() {
      const lang = guessDefaultLang();
      return setLanguage(lang);
    },
    async use(lang) {
      return setLanguage(lang);
    },
    getStoredLang() {
      return localStorage.getItem(STORAGE_KEY) || guessDefaultLang();
    },
  };

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-set-lang]");
    if (!btn) return;
    e.preventDefault();
    const lang = btn.getAttribute("data-set-lang");
    if (lang === "en" || lang === "es") {
      void setLanguage(lang);
    }
  });
})();
