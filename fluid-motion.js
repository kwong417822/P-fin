(function () {
  "use strict";

  /*
   * Aquarise motion is intentionally an adapter around the accepted static
   * UI. It owns only its own targets and temporary styles; it never changes a
   * financial value or chart geometry.
   */
  var state = {
    active: false,
    reduced: false,
    printing: false,
    hidden: false,
    motionQuery: null,
    targets: [],
    entryObserver: null,
    entrySafetyTimer: 0,
    primeTimer: 0,
    flowTimer: 0,
    dialogObserver: null,
    flowObserver: null,
    metricObserver: null,
    visibilityObserver: null,
    metricTimer: 0,
    metricsPrimed: false,
    metricsPending: false,
    metricElements: [],
    reportWaterRevealed: false,
    reportWaterAnimating: false,
    heroVisible: true,
    reportVisible: true,
    heroIntroPlayed: false,
    listeners: [],
    mediaListener: null
  };

  var refs = {
    body: null,
    hero: null,
    heroTitle: null,
    heroSubtitle: null,
    report: null,
    reportWaterImage: null,
    dialog: null,
    dialogHeader: null,
    dialogSections: [],
    flow: null,
    flowToggle: null,
    details: null,
    detailsContent: null
  };

  function query(selector, root) {
    return (root || document).querySelector(selector);
  }

  function queryAll(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function hasGsap() {
    return Boolean(window.gsap && typeof window.gsap.to === "function" && typeof window.gsap.fromTo === "function");
  }

  function reducedMotionQuery() {
    if (typeof window.matchMedia !== "function") {
      return { matches: false, addEventListener: function () {}, removeEventListener: function () {} };
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)");
  }

  function finePointerAvailable() {
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(pointer: fine)").matches;
  }

  function addListener(target, type, handler, options) {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(type, handler, options || false);
    state.listeners.push(function () {
      target.removeEventListener(type, handler, options || false);
    });
  }

  function setDiagnostic(value) {
    if (!refs.body) return;
    refs.body.dataset.fluidMotion = value;
    refs.body.dataset.fluidMotionActive = state.active ? "true" : "false";
  }

  function clearOwnedStyle(element) {
    if (!element) return;
    if (hasGsap()) {
      try {
        window.gsap.set(element, { clearProps: "transform,opacity,filter" });
      } catch (error) {
        /* A CSS fallback below still restores the resting presentation. */
      }
    }
    element.style.removeProperty("transform");
    element.style.removeProperty("opacity");
    element.style.removeProperty("filter");
  }

  function killOwnedTween(element) {
    if (!element || !hasGsap() || typeof window.gsap.killTweensOf !== "function") return;
    try {
      window.gsap.killTweensOf(element);
    } catch (error) {
      /* GSAP is optional; the native state remains usable. */
    }
  }

  function markEntered(element) {
    if (!element) return;
    element.dataset.entered = "true";
    element.removeAttribute("data-fluid-motion-state");
    clearOwnedStyle(element);
  }

  function registerTarget(element, role) {
    if (!element || state.targets.indexOf(element) !== -1) return;
    element.dataset.fluidMotionRole = role;
    state.targets.push(element);
  }

  function finishTarget(element) {
    if (!element) return;
    killOwnedTween(element);
    markEntered(element);
  }

  function animateEntry(element, delay) {
    if (!element || element.dataset.entered === "true") return;
    if (!hasGsap() || state.reduced || state.printing || state.hidden) {
      markEntered(element);
      if (element === refs.report) animateReportWater();
      return;
    }

    element.dataset.fluidMotionState = "entering";
    window.gsap.killTweensOf(element);
    window.gsap.fromTo(
      element,
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: .52,
        delay: Math.min(.18, Number(delay) || 0),
        ease: "power3.out",
        clearProps: "transform,opacity",
        onComplete: function () { markEntered(element); }
      }
    );
    if (element === refs.report) animateReportWater();
  }

  function setupReferences() {
    refs.body = document.body;
    refs.hero = query(".deep-hero");
    refs.heroTitle = query(".deep-hero h1");
    refs.heroSubtitle = query(".deep-hero-subtitle");
    refs.report = query(".deep-report-panel");
    refs.reportWaterImage = query(".deep-report-water > img");
    refs.dialog = query("#advancedDialog");
    refs.dialogHeader = query(".deep-dialog-header", refs.dialog || document);
    refs.dialogSections = queryAll(".deep-dialog-section", refs.dialog || document);
    refs.flow = query("#deepReportFlow");
    refs.flowToggle = query("#deepFlowToggle");
    refs.details = query("#deep-details");
    refs.detailsContent = query(".deep-legacy-content", refs.details || document);
    refs.metricElements = [
      query("#deepReportYear"),
      query("#deepReportInvested"),
      query("#deepReportInterest"),
      query("#deepScenarioLowValue"),
      query("#deepScenarioBaseValue"),
      query("#deepScenarioHighValue")
    ].filter(Boolean);
    state.metricElements = refs.metricElements;
  }

  function setupControls() {
    queryAll("button, summary, [role=button]", document).forEach(function (element) {
      if (element.closest && !element.closest(".deep-flow-page")) return;
      element.dataset.fluidControl = "true";
    });
  }

  function playHeroIntro() {
    var introElements = [refs.heroTitle, refs.heroSubtitle].filter(Boolean);
    if (!introElements.length) return;

    if (refs.body.dataset.fluidIntroPlayed === "true") {
      introElements.forEach(markEntered);
      state.heroIntroPlayed = true;
      return;
    }

    refs.body.dataset.fluidIntroPlayed = "true";
    state.heroIntroPlayed = true;

    if (!hasGsap() || state.reduced || state.printing || state.hidden) {
      introElements.forEach(markEntered);
      return;
    }

    introElements.forEach(function (element) {
      element.dataset.fluidMotionState = "entering";
    });
    window.gsap.fromTo(
      introElements,
      { opacity: 0, y: 14, filter: "blur(3px)" },
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: .48,
        stagger: .08,
        ease: "power3.out",
        clearProps: "transform,opacity,filter",
        onComplete: function () { introElements.forEach(markEntered); }
      }
    );
  }

  function setHeroOffset(x, y) {
    if (!refs.hero) return;
    refs.hero.style.setProperty("--fluid-hero-x", x + "px");
    refs.hero.style.setProperty("--fluid-hero-y", y + "px");
  }

  function resetHeroOffset() {
    if (!refs.hero) return;
    killOwnedTween(refs.hero);
    refs.hero.style.removeProperty("--fluid-hero-x");
    refs.hero.style.removeProperty("--fluid-hero-y");
  }

  function setupHeroParallax() {
    if (!refs.hero || !finePointerAvailable()) return;

    var move = function (event) {
      if (!state.active || state.reduced || state.printing || state.hidden || state.heroVisible === false || event.pointerType === "touch") return;
      var rect = refs.hero.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var x = ((event.clientX - rect.left) / rect.width - .5) * 12;
      var y = ((event.clientY - rect.top) / rect.height - .5) * 8;
      if (!hasGsap()) {
        setHeroOffset(x, y);
        return;
      }
      window.gsap.to(refs.hero, {
        "--fluid-hero-x": x + "px",
        "--fluid-hero-y": y + "px",
        duration: .42,
        ease: "power2.out",
        overwrite: "auto"
      });
    };
    var leave = function () {
      if (state.reduced || state.printing || state.hidden || !refs.hero) return;
      if (!hasGsap()) {
        resetHeroOffset();
        return;
      }
      window.gsap.to(refs.hero, {
        "--fluid-hero-x": "0px",
        "--fluid-hero-y": "0px",
        duration: .5,
        ease: "power2.out",
        overwrite: "auto",
        onComplete: resetHeroOffset
      });
    };
    addListener(refs.hero, "pointermove", move, { passive: true });
    addListener(refs.hero, "pointerleave", leave, { passive: true });
  }

  function animateReportWater() {
    if (state.reportWaterRevealed || !refs.reportWaterImage || state.reportVisible === false) return;
    state.reportWaterRevealed = true;
    state.reportWaterAnimating = true;
    refs.reportWaterImage.dataset.fluidMotionRole = "report-water";

    if (!hasGsap() || state.reduced || state.printing || state.hidden) {
      state.reportWaterAnimating = false;
      markEntered(refs.reportWaterImage);
      return;
    }

    window.gsap.killTweensOf(refs.reportWaterImage);
    var timeline = window.gsap.timeline({
      onComplete: function () {
        state.reportWaterAnimating = false;
        markEntered(refs.reportWaterImage);
      }
    });
    timeline.fromTo(
      refs.reportWaterImage,
      { opacity: .34, y: 16, scale: 1.035 },
      { opacity: 1, y: 0, scale: 1, duration: .56, ease: "power2.out" }
    ).to(
      refs.reportWaterImage,
      { y: -4, duration: .32, ease: "sine.inOut", yoyo: true, repeat: 1, clearProps: "transform,opacity" }
    );
  }

  function stopReportWaterMotion() {
    if (!refs.reportWaterImage || !state.reportWaterAnimating) return;
    killOwnedTween(refs.reportWaterImage);
    clearOwnedStyle(refs.reportWaterImage);
    refs.reportWaterImage.removeAttribute("data-fluid-motion-state");
    state.reportWaterAnimating = false;
    state.reportWaterRevealed = false;
  }

  function setupVisibilityObserver() {
    if (typeof window.IntersectionObserver !== "function") return;
    var observed = [refs.hero, refs.report].filter(Boolean);
    if (!observed.length) return;
    state.visibilityObserver = new window.IntersectionObserver(function (entries) {
      if (!state.active) return;
      entries.forEach(function (entry) {
        var visible = Boolean(entry.isIntersecting || entry.intersectionRatio > 0);
        if (entry.target === refs.hero) {
          state.heroVisible = visible;
          if (!visible) resetHeroOffset();
        }
        if (entry.target === refs.report) {
          state.reportVisible = visible;
          if (!visible) stopReportWaterMotion();
          else if (!state.reportWaterRevealed) animateReportWater();
        }
      });
    }, { threshold: 0 });
    observed.forEach(function (element) { state.visibilityObserver.observe(element); });
  }

  function setupScrollEntrances() {
    queryAll(".deep-primary-field").forEach(function (element) { registerTarget(element, "primary-field"); });
    registerTarget(refs.report, "report-panel");
    registerTarget(query(".deep-scenario-comparison"), "scenario-comparison");
    registerTarget(refs.details, "details-panel");

    if (!state.targets.length) return;
    /* A keyboard user may reach a control before its section intersects the
       viewport. Reveal that section immediately without moving focus. */
    addListener(document, "focusin", function (event) {
      state.targets.some(function (element) {
        if (element === event.target || (element.contains && element.contains(event.target))) {
          animateEntry(element, 0);
          return true;
        }
        return false;
      });
    });
    if (!hasGsap() || state.reduced || state.printing || state.hidden) {
      state.targets.forEach(animateEntry);
      return;
    }

    state.targets.forEach(function (element) {
      if (element.dataset.entered !== "true") {
        element.dataset.fluidMotionState = "pending";
        window.gsap.set(element, { opacity: 0, y: 16 });
      }
    });

    if (typeof window.IntersectionObserver !== "function") {
      state.targets.forEach(function (element, index) { animateEntry(element, index * .06); });
      return;
    }

    state.entryObserver = new window.IntersectionObserver(function (entries) {
      if (!state.active || !state.entryObserver) return;
      entries.forEach(function (entry, index) {
        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          animateEntry(entry.target, index * .05);
          if (state.active && state.entryObserver) state.entryObserver.unobserve(entry.target);
        }
      });
    }, { threshold: .12, rootMargin: "0px 0px -8% 0px" });
    state.targets.forEach(function (element) {
      if (element.dataset.entered !== "true") state.entryObserver.observe(element);
    });

    /* A broken observer must never leave a section hidden. */
    state.entrySafetyTimer = window.setTimeout(function () {
      if (!state.active) return;
      state.targets.forEach(function (element) {
        if (element.dataset.entered !== "true" && element.getBoundingClientRect().top < window.innerHeight * 1.3) {
          animateEntry(element, 0);
        }
      });
    }, 2200);
  }

  function animateDialog() {
    var elements = [refs.dialogHeader].concat(refs.dialogSections).filter(Boolean);
    if (!elements.length) return;
    if (!hasGsap() || state.reduced || state.printing || state.hidden) {
      elements.forEach(markEntered);
      return;
    }
    elements.forEach(function (element) { element.dataset.fluidMotionState = "entering"; });
    window.gsap.killTweensOf(elements);
    window.gsap.fromTo(
      elements,
      { opacity: 0, y: 9 },
      {
        opacity: 1,
        y: 0,
        duration: .36,
        stagger: .045,
        ease: "power2.out",
        clearProps: "transform,opacity",
        onComplete: function () { elements.forEach(markEntered); }
      }
    );
  }

  function clearDialogMotion() {
    [refs.dialogHeader].concat(refs.dialogSections).filter(Boolean).forEach(function (element) {
      killOwnedTween(element);
      markEntered(element);
    });
  }

  function setupDialogMotion() {
    if (!refs.dialog) return;
    state.dialogObserver = typeof window.MutationObserver === "function"
      ? new window.MutationObserver(function () {
          if (!state.active) return;
          if (refs.dialog.open || refs.dialog.hasAttribute("open")) {
            refs.dialog.dataset.fluidDialog = "open";
            animateDialog();
          } else {
            refs.dialog.dataset.fluidDialog = "closed";
            clearDialogMotion();
          }
        })
      : null;
    if (state.dialogObserver) state.dialogObserver.observe(refs.dialog, { attributes: true, attributeFilter: ["open"] });
    addListener(refs.dialog, "close", clearDialogMotion);
    if (refs.dialog.open || refs.dialog.hasAttribute("open")) animateDialog();
  }

  function animateFlowDisclosure() {
    if (!state.active || !refs.flow) return;
    if (refs.flow.hidden) {
      killOwnedTween(refs.flow);
      clearOwnedStyle(refs.flow);
      return;
    }
    if (!hasGsap() || state.reduced || state.printing || state.hidden) {
      markEntered(refs.flow);
      return;
    }
    window.gsap.killTweensOf(refs.flow);
    refs.flow.dataset.fluidMotionState = "entering";
    window.gsap.fromTo(
      refs.flow,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: .32, ease: "power2.out", clearProps: "transform,opacity", onComplete: function () { markEntered(refs.flow); } }
    );
  }

  function animateDetailsDisclosure() {
    if (!state.active || !refs.details || !refs.details.open || !refs.detailsContent) return;
    if (!hasGsap() || state.reduced || state.printing || state.hidden) {
      markEntered(refs.detailsContent);
      return;
    }
    window.gsap.killTweensOf(refs.detailsContent);
    refs.detailsContent.dataset.fluidMotionState = "entering";
    window.gsap.fromTo(
      refs.detailsContent,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: .46, ease: "power2.out", clearProps: "transform,opacity", onComplete: function () { markEntered(refs.detailsContent); } }
    );
  }

  function scheduleFlowDisclosure() {
    if (state.flowTimer) window.clearTimeout(state.flowTimer);
    state.flowTimer = window.setTimeout(function () {
      state.flowTimer = 0;
      if (state.active) animateFlowDisclosure();
    }, 0);
  }

  function setupDisclosureMotion() {
    if (refs.flow) {
      state.flowObserver = typeof window.MutationObserver === "function"
        ? new window.MutationObserver(function () {
            if (state.active) scheduleFlowDisclosure();
          })
        : null;
      if (state.flowObserver) state.flowObserver.observe(refs.flow, { attributes: true, attributeFilter: ["hidden"] });
    }
    if (refs.details) {
      addListener(refs.details, "toggle", function () {
        if (refs.details.open) animateDetailsDisclosure();
        else if (refs.detailsContent) {
          killOwnedTween(refs.detailsContent);
          clearOwnedStyle(refs.detailsContent);
        }
      });
      if (refs.details.open) animateDetailsDisclosure();
    }
  }

  function findMetric(node) {
    var found = null;
    state.metricElements.some(function (element) {
      if (node === element || (node && element.contains && element.contains(node))) {
        found = element;
        return true;
      }
      return false;
    });
    return found;
  }

  function pulseMetric(element) {
    if (!element || state.reduced || state.printing || state.hidden || !hasGsap()) return;
    window.gsap.killTweensOf(element);
    window.gsap.fromTo(
      element,
      { opacity: .7, y: 3, filter: "brightness(1.14)" },
      { opacity: 1, y: 0, filter: "brightness(1)", duration: .22, ease: "power2.out", clearProps: "transform,opacity,filter" }
    );
  }

  function primeMetrics() {
    state.metricElements.forEach(function (element) {
      element.dataset.fluidMetricValue = element.textContent;
    });
    state.metricsPrimed = true;
    state.metricsPending = false;
  }

  function handleMetricMutations(records) {
    if (!state.active) return;
    var changed = [];
    records.forEach(function (record) {
      var metric = findMetric(record.target);
      if (metric && changed.indexOf(metric) === -1) changed.push(metric);
    });
    if (!changed.length) return;
    if (!state.metricsPrimed) {
      state.metricsPending = true;
      return;
    }
    changed.forEach(function (metric) {
      var next = metric.textContent;
      if (metric.dataset.fluidMetricValue !== next) {
        metric.dataset.fluidMetricValue = next;
        pulseMetric(metric);
      }
    });
  }

  function setupMetricMotion() {
    if (!state.metricElements.length || typeof window.MutationObserver !== "function") return;
    state.metricObserver = new window.MutationObserver(handleMetricMutations);
    state.metricElements.forEach(function (element) {
      state.metricObserver.observe(element, { childList: true, characterData: true, subtree: true });
    });
    state.primeTimer = window.setTimeout(function () {
      state.primeTimer = 0;
      if (state.active) primeMetrics();
    }, 0);
  }

  function finishAllMotion() {
    state.targets.forEach(finishTarget);
    [refs.heroTitle, refs.heroSubtitle, refs.reportWaterImage, refs.dialogHeader]
      .concat(refs.dialogSections, [refs.flow, refs.detailsContent])
      .filter(Boolean)
      .forEach(finishTarget);
    state.metricElements.forEach(function (element) {
      killOwnedTween(element);
      clearOwnedStyle(element);
    });
    resetHeroOffset();
    state.reportWaterAnimating = false;
    state.reportWaterRevealed = true;
  }

  function handleMotionPreference(event) {
    state.reduced = Boolean(event && event.matches);
    setDiagnostic(state.reduced ? "reduced" : "enabled");
    if (state.reduced) finishAllMotion();
  }

  function handleVisibility() {
    state.hidden = document.visibilityState === "hidden";
    if (state.hidden) finishAllMotion();
  }

  function handleBeforePrint() {
    state.printing = true;
    finishAllMotion();
  }

  function handleAfterPrint() {
    state.printing = false;
  }

  function removeListeners() {
    state.listeners.splice(0).forEach(function (remove) {
      try { remove(); } catch (error) { /* teardown should remain best effort */ }
    });
  }

  function destroy() {
    if (!state.active) return;
    state.active = false;
    setDiagnostic(state.reduced ? "reduced" : "enabled");
    if (state.entrySafetyTimer) window.clearTimeout(state.entrySafetyTimer);
    if (state.metricTimer) window.clearTimeout(state.metricTimer);
    if (state.primeTimer) window.clearTimeout(state.primeTimer);
    if (state.flowTimer) window.clearTimeout(state.flowTimer);
    if (state.entryObserver) state.entryObserver.disconnect();
    if (state.dialogObserver) state.dialogObserver.disconnect();
    if (state.flowObserver) state.flowObserver.disconnect();
    if (state.metricObserver) state.metricObserver.disconnect();
    if (state.visibilityObserver) state.visibilityObserver.disconnect();
    finishAllMotion();
    removeListeners();
    if (state.motionQuery && state.mediaListener) {
      if (typeof state.motionQuery.removeEventListener === "function") state.motionQuery.removeEventListener("change", state.mediaListener);
      else if (typeof state.motionQuery.removeListener === "function") state.motionQuery.removeListener(state.mediaListener);
    }
    state.entryObserver = null;
    state.dialogObserver = null;
    state.flowObserver = null;
    state.metricObserver = null;
    state.visibilityObserver = null;
    state.mediaListener = null;
    state.targets = [];
    state.metricElements = [];
    state.primeTimer = 0;
    state.flowTimer = 0;
    state.metricsPrimed = false;
    state.reportWaterRevealed = false;
    state.reportWaterAnimating = false;
    if (refs.body) refs.body.dataset.fluidMotionActive = "false";
  }

  function start() {
    if (state.active || !document.body || !document.body.classList.contains("deep-flow-page")) return;
    state.active = true;
    state.hidden = document.visibilityState === "hidden";
    state.heroVisible = true;
    state.reportVisible = true;
    state.motionQuery = reducedMotionQuery();
    state.reduced = Boolean(state.motionQuery.matches);
    setupReferences();
    setDiagnostic(state.reduced ? "reduced" : "enabled");
    setupControls();
    playHeroIntro();
    setupHeroParallax();
    setupVisibilityObserver();
    setupScrollEntrances();
    setupDialogMotion();
    setupDisclosureMotion();
    setupMetricMotion();
    state.mediaListener = handleMotionPreference;
    if (state.motionQuery && typeof state.motionQuery.addEventListener === "function") state.motionQuery.addEventListener("change", state.mediaListener);
    else if (state.motionQuery && typeof state.motionQuery.addListener === "function") state.motionQuery.addListener(state.mediaListener);
    addListener(document, "visibilitychange", handleVisibility);
    addListener(window, "beforeprint", handleBeforePrint);
    addListener(window, "afterprint", handleAfterPrint);
  }

  function handlePageHide() {
    destroy();
  }

  function handlePageShow(event) {
    if (event && event.persisted) start();
  }

  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("pageshow", handlePageShow);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}());
