import {
  createRipple,
  supportsHtmlInCanvas
} from "./assets/vendor/canvas-ui/RippleVanilla.js";

const motionQuery = typeof window.matchMedia === "function"
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : {
      matches: false,
      addEventListener() {},
      removeEventListener() {}
    };

function subscribeToMotion(query, handler) {
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }

  if (typeof query.addListener === "function") {
    query.addListener(handler);
    return () => query.removeListener(handler);
  }

  return () => {};
}

function initEnhancements() {
  const summaryGrid = document.getElementById("summaryGrid");
  const rippleHost = document.getElementById("brandRippleHost");
  const source = document.getElementById("brandRippleSource");
  const content = document.getElementById("brandRippleContent");
  const output = document.getElementById("brandRippleOutput");

  let rippleInstance = null;
  let quietTimer = 0;
  let rippleVisibilityObserver = null;
  let summaryObserver = null;
  let activeSummaryValues = [];
  let tornDown = false;

  const setRippleState = (state) => {
    if (rippleHost) {
      rippleHost.dataset.rippleState = state;
    }
  };

  const clearQuietTimer = () => {
    if (quietTimer) {
      window.clearTimeout(quietTimer);
      quietTimer = 0;
    }
  };

  const destroyRipple = () => {
    clearQuietTimer();
    rippleInstance?.destroy();
    rippleInstance = null;
    setRippleState("fallback");
  };

  const canUseRipple = () => {
    if (
      tornDown ||
      motionQuery.matches ||
      !rippleHost ||
      !source ||
      !content ||
      !output ||
      !source.hasAttribute("layoutsubtree") ||
      typeof supportsHtmlInCanvas !== "function" ||
      typeof window.WebGL2RenderingContext === "undefined" ||
      typeof window.ResizeObserver !== "function" ||
      typeof window.IntersectionObserver !== "function"
    ) {
      return false;
    }

    try {
      const sourceContext = source.getContext("2d");
      const outputContext = output.getContext("webgl2");
      return Boolean(
        sourceContext &&
        typeof sourceContext.reset === "function" &&
        typeof sourceContext.drawElementImage === "function" &&
        typeof source.requestPaint === "function" &&
        outputContext &&
        !outputContext.isContextLost() &&
        supportsHtmlInCanvas()
      );
    } catch {
      return false;
    }
  };

  const createBrandRipple = () => {
    if (rippleInstance || !canUseRipple()) {
      return;
    }

    try {
      rippleInstance = createRipple(
        { source, content, output },
        {
          amplitude: 0.22,
          speed: 0.72,
          wavelength: 62,
          rings: 2,
          decay: 1.35,
          refraction: 18,
          dispersion: 0.04,
          shine: 0.2,
          trigger: "none",
          interval: 0
        }
      );
      setRippleState(rippleInstance ? "enhanced" : "fallback");
    } catch {
      destroyRipple();
    }
  };

  const handleBrandPointerDown = (event) => {
    if (
      tornDown ||
      motionQuery.matches ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }

    createBrandRipple();
    if (!rippleInstance || !output) {
      return;
    }

    const rect = output.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const x = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
    const y = Math.min(rect.height, Math.max(0, event.clientY - rect.top));
    rippleInstance.splash(x, y, 1);
    clearQuietTimer();
    quietTimer = window.setTimeout(destroyRipple, 2200);
  };

  if (rippleHost) {
    setRippleState("fallback");
    rippleHost.addEventListener("pointerdown", handleBrandPointerDown, { passive: true });
  }

  const killSummaryTweens = () => {
    if (window.gsap && activeSummaryValues.length) {
      window.gsap.killTweensOf(activeSummaryValues);
      window.gsap.set(activeSummaryValues, {
        clearProps: "transform,opacity,filter"
      });
    }
    activeSummaryValues = [];
  };

  const handleMotionChange = () => {
    killSummaryTweens();
    destroyRipple();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      destroyRipple();
    }
  };

  const removeMotionListener = subscribeToMotion(motionQuery, handleMotionChange);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  if (output && typeof window.IntersectionObserver === "function") {
    rippleVisibilityObserver = new window.IntersectionObserver((entries) => {
      if (entries.some((entry) => !entry.isIntersecting)) {
        destroyRipple();
      }
    });
    rippleVisibilityObserver.observe(output);
  }

  const teardown = () => {
    if (tornDown) {
      return;
    }
    tornDown = true;
    destroyRipple();
    killSummaryTweens();
    rippleVisibilityObserver?.disconnect();
    summaryObserver?.disconnect();
    removeMotionListener();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    rippleHost?.removeEventListener("pointerdown", handleBrandPointerDown);
    window.removeEventListener("pagehide", teardown);
  };

  window.addEventListener("pagehide", teardown);

  if (!summaryGrid) {
    return;
  }

  let hasRenderedOnce = summaryGrid.children.length > 0;
  summaryObserver = new MutationObserver(() => {
    killSummaryTweens();
    if (!hasRenderedOnce) {
      hasRenderedOnce = true;
      return;
    }

    if (tornDown || motionQuery.matches || !window.gsap) {
      return;
    }

    activeSummaryValues = Array.from(summaryGrid.querySelectorAll(".summary-value"));
    if (!activeSummaryValues.length) {
      return;
    }

    window.gsap.fromTo(
      activeSummaryValues,
      {
        y: 4,
        opacity: 0.72,
        filter: "brightness(1.12)"
      },
      {
        duration: 0.2,
        y: 0,
        opacity: 1,
        filter: "brightness(1)",
        ease: "power2.out",
        stagger: 0.02,
        clearProps: "filter"
      }
    );
  });

  summaryObserver.observe(summaryGrid, { childList: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initEnhancements, { once: true });
} else {
  initEnhancements();
}

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    initEnhancements();
  }
});
