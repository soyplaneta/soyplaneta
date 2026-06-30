/**
 * ESAL report: preview thumbnail + modal PDF viewer (PDF.js) with zoom.
 */
(function () {
  const PDF_PATH = "assets/files/informe_resultados_esal.pdf";
  const PDFJS_VERSION = "4.10.38";
  const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
  const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

  function assetUrl(path) {
    const base = typeof window !== "undefined" && window.SOYPLANETA_BASE ? window.SOYPLANETA_BASE : "";
    const normalized = path.replace(/^\//, "");
    return base ? `${base}/${normalized}` : normalized;
  }

  async function loadPdfJs() {
    if (window.__soyplanetaPdfJs) return window.__soyplanetaPdfJs;
    const pdfjsLib = await import(`${PDFJS_CDN}/pdf.min.mjs`);
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.mjs`;
    window.__soyplanetaPdfJs = pdfjsLib;
    return pdfjsLib;
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

  function setupLegalPdfViewer() {
    const openBtn = document.getElementById("legal-pdf-open");
    const modal = document.getElementById("legal-pdf-modal");
    const coverHost = document.getElementById("legal-pdf-cover");
    const viewport = document.getElementById("legal-pdf-viewport");
    const canvas = document.getElementById("legal-pdf-canvas");
    const bookLoading = document.getElementById("legal-pdf-book-loading");
    const pageIndicator = document.getElementById("legal-pdf-page-indicator");
    const zoomIndicator = document.getElementById("legal-pdf-zoom");
    const prevBtn = document.getElementById("legal-pdf-prev");
    const nextBtn = document.getElementById("legal-pdf-next");
    const zoomOutBtn = document.getElementById("legal-pdf-zoom-out");
    const zoomInBtn = document.getElementById("legal-pdf-zoom-in");

    if (!openBtn || !modal || !coverHost || !viewport || !canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    let pdfPromise = null;
    let pdfDoc = null;
    let pageCount = 0;
    let currentPage = 1;
    let zoomIndex = ZOOM_STEPS.indexOf(1);
    if (zoomIndex < 0) zoomIndex = 1;
    let viewerReady = false;
    let renderToken = 0;
    let lastFocus = null;

    function getPdf() {
      if (!pdfPromise) pdfPromise = loadPdfDocument();
      return pdfPromise;
    }

    function getPixelRatio() {
      return Math.min(window.devicePixelRatio || 1, 3);
    }

    function getViewportWidth() {
      const styles = window.getComputedStyle(viewport);
      const paddingX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      return Math.max(240, viewport.clientWidth - paddingX);
    }

    async function renderPageToCanvas(pdf, pageNumber, targetCssWidth, zoom) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = targetCssWidth / baseViewport.width;
      const pixelRatio = getPixelRatio();
      const renderScale = fitScale * zoom * pixelRatio;
      const renderViewport = page.getViewport({ scale: renderScale });
      canvas.width = Math.floor(renderViewport.width);
      canvas.height = Math.floor(renderViewport.height);
      canvas.style.width = `${Math.floor(renderViewport.width / pixelRatio)}px`;
      canvas.style.height = `${Math.floor(renderViewport.height / pixelRatio)}px`;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      await page.render({ canvasContext: context, viewport: renderViewport }).promise;
    }

    async function renderPageImage(pdf, pageNumber, targetCssWidth) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = targetCssWidth / baseViewport.width;
      const pixelRatio = getPixelRatio();
      const renderScale = fitScale * pixelRatio;
      const renderViewport = page.getViewport({ scale: renderScale });
      const offscreen = document.createElement("canvas");
      const offscreenContext = offscreen.getContext("2d", { alpha: false });
      offscreen.width = Math.floor(renderViewport.width);
      offscreen.height = Math.floor(renderViewport.height);
      await page.render({ canvasContext: offscreenContext, viewport: renderViewport }).promise;
      return {
        dataUrl: offscreen.toDataURL("image/png"),
        width: Math.floor(renderViewport.width / pixelRatio),
        height: Math.floor(renderViewport.height / pixelRatio),
      };
    }

    function updateControls() {
      if (pageIndicator && pageCount) {
        pageIndicator.textContent = `${currentPage} / ${pageCount}`;
      }
      if (zoomIndicator) {
        zoomIndicator.textContent = `${Math.round(ZOOM_STEPS[zoomIndex] * 100)}%`;
      }
      if (prevBtn) prevBtn.disabled = currentPage <= 1;
      if (nextBtn) nextBtn.disabled = currentPage >= pageCount;
      if (zoomOutBtn) zoomOutBtn.disabled = zoomIndex <= 0;
      if (zoomInBtn) zoomInBtn.disabled = zoomIndex >= ZOOM_STEPS.length - 1;
    }

    async function renderCurrentPage() {
      if (!pdfDoc) return;
      const token = ++renderToken;
      await renderPageToCanvas(pdfDoc, currentPage, getViewportWidth(), ZOOM_STEPS[zoomIndex]);
      if (token !== renderToken) return;
      updateControls();
    }

    async function renderCoverPreview() {
      const loadingEl = coverHost.querySelector(".legal-compliance__open-loading");
      try {
        const pdf = await getPdf();
        pageCount = pdf.numPages;
        const targetWidth = Math.min(320, getViewportWidth() || 320);
        const { dataUrl, width, height } = await renderPageImage(pdf, 1, targetWidth);
        coverHost.innerHTML = "";
        const img = document.createElement("img");
        img.src = dataUrl;
        img.alt = "";
        img.width = width;
        img.height = height;
        img.className = "legal-compliance__open-thumb";
        coverHost.appendChild(img);
      } catch (err) {
        console.error(err);
        if (loadingEl) loadingEl.textContent = "…";
      }
    }

    async function ensureViewer() {
      if (viewerReady) {
        await renderCurrentPage();
        return;
      }
      setHidden(bookLoading, false);
      pdfDoc = await getPdf();
      pageCount = pdfDoc.numPages;
      currentPage = 1;
      await renderCurrentPage();
      viewerReady = true;
      setHidden(bookLoading, true);
    }

    function openModal() {
      lastFocus = document.activeElement;
      setHidden(modal, false);
      document.body.classList.add("legal-compliance-modal-open");
      void ensureViewer().then(() => {
        modal.querySelector(".legal-compliance-modal__close")?.focus();
      });
    }

    function closeModal() {
      setHidden(modal, true);
      document.body.classList.remove("legal-compliance-modal-open");
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    }

    function goToPage(page) {
      const nextPage = Math.min(pageCount, Math.max(1, page));
      if (nextPage === currentPage) return;
      currentPage = nextPage;
      viewport.scrollTop = 0;
      viewport.scrollLeft = 0;
      void renderCurrentPage();
    }

    function changeZoom(delta) {
      const nextIndex = Math.min(ZOOM_STEPS.length - 1, Math.max(0, zoomIndex + delta));
      if (nextIndex === zoomIndex) return;
      zoomIndex = nextIndex;
      void renderCurrentPage();
    }

    openBtn.addEventListener("click", openModal);

    modal.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", closeModal);
    });

    prevBtn?.addEventListener("click", () => goToPage(currentPage - 1));
    nextBtn?.addEventListener("click", () => goToPage(currentPage + 1));
    zoomOutBtn?.addEventListener("click", () => changeZoom(-1));
    zoomInBtn?.addEventListener("click", () => changeZoom(1));

    document.addEventListener("keydown", (event) => {
      if (modal.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key === "ArrowLeft") goToPage(currentPage - 1);
      if (event.key === "ArrowRight") goToPage(currentPage + 1);
      if (event.key === "+" || event.key === "=") changeZoom(1);
      if (event.key === "-") changeZoom(-1);
    });

    window.addEventListener("resize", () => {
      if (!viewerReady || modal.hidden) return;
      void renderCurrentPage();
    });

    void renderCoverPreview();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupLegalPdfViewer);
  } else {
    setupLegalPdfViewer();
  }
})();
