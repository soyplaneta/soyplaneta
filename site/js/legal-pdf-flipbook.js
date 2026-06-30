/**
 * ESAL report: preview thumbnail + modal page-flip viewer (PDF.js + StPageFlip).
 */
(function () {
  const PDF_PATH = "assets/files/informe_resultados_esal.pdf";
  const PDFJS_VERSION = "4.10.38";
  const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

  function assetUrl(path) {
    const base = typeof window !== "undefined" && window.SOYPLANETA_BASE ? window.SOYPLANETA_BASE : "";
    const normalized = path.replace(/^\//, "");
    return base ? `${base}/${normalized}` : normalized;
  }

  function waitForPageFlip() {
    return new Promise((resolve, reject) => {
      if (window.St && window.St.PageFlip) {
        resolve(window.St.PageFlip);
        return;
      }
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (window.St && window.St.PageFlip) {
          clearInterval(timer);
          resolve(window.St.PageFlip);
        } else if (attempts > 100) {
          clearInterval(timer);
          reject(new Error("PageFlip library failed to load"));
        }
      }, 50);
    });
  }

  async function loadPdfJs() {
    if (window.__soyplanetaPdfJs) return window.__soyplanetaPdfJs;
    const pdfjsLib = await import(`${PDFJS_CDN}/pdf.min.mjs`);
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.mjs`;
    window.__soyplanetaPdfJs = pdfjsLib;
    return pdfjsLib;
  }

  async function renderPageImage(pdf, pageNumber, scale) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;
    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.92),
      width: canvas.width,
      height: canvas.height,
    };
  }

  async function loadPdfDocument() {
    const pdfjsLib = await loadPdfJs();
    const task = pdfjsLib.getDocument(assetUrl(PDF_PATH));
    return task.promise;
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = hidden;
    if (hidden) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  }

  function setupLegalPdfFlipbook() {
    const openBtn = document.getElementById("legal-pdf-open");
    const modal = document.getElementById("legal-pdf-modal");
    const coverHost = document.getElementById("legal-pdf-cover");
    const bookHost = document.getElementById("legal-pdf-book");
    const bookLoading = document.getElementById("legal-pdf-book-loading");
    const pageIndicator = document.getElementById("legal-pdf-page-indicator");
    const prevBtn = document.getElementById("legal-pdf-prev");
    const nextBtn = document.getElementById("legal-pdf-next");

    if (!openBtn || !modal || !coverHost || !bookHost) return;

    let pdfPromise = null;
    let pageFlip = null;
    let pageCount = 0;
    let bookReady = false;
    let lastFocus = null;

    function getPdf() {
      if (!pdfPromise) pdfPromise = loadPdfDocument();
      return pdfPromise;
    }

    function updateIndicator(currentIndex) {
      if (!pageIndicator || !pageCount) return;
      pageIndicator.textContent = `${currentIndex + 1} / ${pageCount}`;
    }

    async function renderCoverPreview() {
      const loadingEl = coverHost.querySelector(".legal-compliance__open-loading");
      try {
        const pdf = await getPdf();
        pageCount = pdf.numPages;
        const { dataUrl } = await renderPageImage(pdf, 1, 1.1);
        coverHost.innerHTML = "";
        const img = document.createElement("img");
        img.src = dataUrl;
        img.alt = "";
        img.width = 320;
        img.height = 420;
        img.className = "legal-compliance__open-thumb";
        coverHost.appendChild(img);
      } catch (err) {
        console.error(err);
        if (loadingEl) loadingEl.textContent = "…";
      }
    }

    async function ensureFlipbook() {
      if (bookReady) return;
      setHidden(bookLoading, false);
      bookHost.innerHTML = "";

      const pdf = await getPdf();
      pageCount = pdf.numPages;
      const PageFlip = await waitForPageFlip();
      const images = [];

      for (let i = 1; i <= pageCount; i += 1) {
        const { dataUrl } = await renderPageImage(pdf, i, 1.35);
        images.push(dataUrl);
      }

      const firstPage = await pdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1.35 });
      const pageWidth = Math.min(Math.floor(viewport.width), 520);
      const pageHeight = Math.min(Math.floor(viewport.height), 720);

      pageFlip = new PageFlip(bookHost, {
        width: pageWidth,
        height: pageHeight,
        size: "stretch",
        minWidth: 280,
        maxWidth: 920,
        minHeight: 360,
        maxHeight: 900,
        maxShadowOpacity: 0.45,
        showCover: false,
        mobileScrollSupport: false,
        usePortrait: true,
      });

      pageFlip.loadFromImages(images);
      pageFlip.on("flip", (event) => {
        updateIndicator(event.data);
      });

      updateIndicator(pageFlip.getCurrentPageIndex());
      bookReady = true;
      setHidden(bookLoading, true);
    }

    function openModal() {
      lastFocus = document.activeElement;
      setHidden(modal, false);
      document.body.classList.add("legal-compliance-modal-open");
      void ensureFlipbook().then(() => {
        modal.querySelector(".legal-compliance-modal__close")?.focus();
      });
    }

    function closeModal() {
      setHidden(modal, true);
      document.body.classList.remove("legal-compliance-modal-open");
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    }

    openBtn.addEventListener("click", () => {
      openModal();
    });

    modal.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", closeModal);
    });

    document.addEventListener("keydown", (event) => {
      if (modal.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }
      if (!pageFlip) return;
      if (event.key === "ArrowLeft") pageFlip.flipPrev();
      if (event.key === "ArrowRight") pageFlip.flipNext();
    });

    prevBtn?.addEventListener("click", () => {
      pageFlip?.flipPrev();
    });

    nextBtn?.addEventListener("click", () => {
      pageFlip?.flipNext();
    });

    void renderCoverPreview();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupLegalPdfFlipbook);
  } else {
    setupLegalPdfFlipbook();
  }
})();
