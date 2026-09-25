(function () {
  "use strict";

  var scenarioKeys = ["low", "base", "high"];
  var scenarioMeta = {
    low: {
      label: "低息率",
      description: "依輸入的低息率\n觀察融資成本",
      color: "#79aab7",
      accent: "#18b9d0"
    },
    base: {
      label: "基本息率",
      description: "依輸入的基本息率\n作為主要參考",
      color: "#2c7082",
      accent: "#0c9c9f"
    },
    high: {
      label: "高息率",
      description: "依輸入的高息率\n觀察融資成本",
      color: "#bc8140",
      accent: "#c48830"
    }
  };
  var componentMeta = [
    { key: "invested", label: "投入資金", className: "invested", color: "#8ea5ad" },
    { key: "principal", label: "融資金額", className: "loan", color: "#1e5364" },
    { key: "interest", label: "累計利息", className: "interest", color: "#d19a3d" },
    { key: "fee", label: "累計手續費", className: "fee", color: "#7489ae" },
    { key: "profit", label: "獲利", className: "profit", color: "#13a38e", negativeColor: "#c32f46" }
  ];

  var root = null;
  var model = {
    projection: null,
    context: null,
    start: 1,
    end: 10,
    inspectedYear: 10,
    scenario: "base",
    initialized: false,
    reducedMotion: false,
    geometry: {},
    listenersBound: false,
    resizeObserver: null,
    intersectionObserver: null,
    motionQuery: null,
    pageHidden: false,
    offscreen: false,
    printing: false,
    renderQueued: false,
    renderFrame: 0,
    animationTargets: [],
    lastVisualKey: ""
  };

  function get(id) {
    return document.getElementById(id);
  }

  function finite(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : (fallback || 0);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getYears() {
    var years = model.context && Number(model.context.years);
    if (!Number.isFinite(years) || years < 1) {
      years = model.projection && model.projection.scenarios && model.projection.scenarios.base
        ? model.projection.scenarios.base.rows.length
        : 40;
    }
    return clamp(Math.round(years || 1), 1, 40);
  }

  function getRows(key) {
    if (!model.projection || !model.projection.scenarios || !model.projection.scenarios[key]) {
      return [];
    }
    return model.projection.scenarios[key].rows || [];
  }

  function getHelpers() {
    return (model.context && model.context.helpers) || {};
  }

  function displayValues(row) {
    var helpers = getHelpers();
    var invested = typeof helpers.investedCapitalDisplay === "function"
      ? helpers.investedCapitalDisplay()
      : 0;
    return {
      invested: finite(invested),
      principal: typeof helpers.loanUsdToDisplay === "function" ? finite(helpers.loanUsdToDisplay(row.principalUsd)) : finite(row.principalUsd),
      interest: typeof helpers.loanUsdToDisplay === "function" ? finite(helpers.loanUsdToDisplay(row.cumulativeInterestUsd)) : finite(row.cumulativeInterestUsd),
      fee: typeof helpers.loanUsdToDisplay === "function" ? finite(helpers.loanUsdToDisplay(row.cumulativeHandlingFeeUsd)) : finite(row.cumulativeHandlingFeeUsd),
      profit: typeof helpers.displayExitPnl === "function" ? finite(helpers.displayExitPnl(row)) : finite(row.exitPnlUsd)
    };
  }

  function formatMoney(value) {
    var helpers = getHelpers();
    if (typeof helpers.displayMoney === "function") return helpers.displayMoney(finite(value));
    var currency = model.context && model.context.currency === "HKD" ? "HK$ " : "$";
    return currency + Math.round(finite(value)).toLocaleString("en-US");
  }

  function formatLoan(valueUsd) {
    var helpers = getHelpers();
    if (typeof helpers.loanMoney === "function") return helpers.loanMoney(finite(valueUsd));
    return formatMoney(valueUsd);
  }

  function formatCompact(value) {
    var helpers = getHelpers();
    if (typeof helpers.compactDisplay === "function") return helpers.compactDisplay(finite(value));
    var abs = Math.abs(finite(value));
    var prefix = value < 0 ? "-" : "";
    var unit = model.context && model.context.currency === "HKD" ? "HKD" : "USD";
    if (abs >= 1000000) return prefix + unit + " " + (abs / 1000000).toFixed(1) + "M";
    if (abs >= 1000) return prefix + unit + " " + Math.round(abs / 1000) + "K";
    return prefix + unit + " " + Math.round(abs);
  }

  function formatAxis(value) {
    var compact = formatCompact(value);
    return compact.replace(/^(-?)(HKD|USD)\s*/, function (_match, sign, currency) {
      return sign + (currency === "HKD" ? "HK$" : "$");
    });
  }

  function getSharedRange() {
    var years = getYears();
    var ranges = model.context && model.context.ranges ? model.context.ranges : {};
    var base = ranges.base || ranges.low || { start: 1, end: Math.min(10, years) };
    var start = clamp(Math.round(finite(base.start, 1)), 1, years);
    var end = clamp(Math.round(finite(base.end, Math.min(10, years))), 1, years);
    if (start > end) {
      var swap = start;
      start = end;
      end = swap;
    }
    return { start: start, end: end };
  }

  function getVisibleRows(key) {
    return getRows(key).filter(function (row) {
      return row && row.year >= model.start && row.year <= model.end;
    });
  }

  function setElementText(id, value) {
    var element = get(id);
    if (element) element.textContent = value;
  }

  function bind() {
    if (model.listenersBound) return;
    root = get("layeredBars");
    if (!root) return;

    var startInput = get("layeredRangeStart");
    var endInput = get("layeredRangeEnd");
    var yearRange = get("layeredYearRange");

    function readRangeInput() {
      var years = getYears();
      var start = clamp(Math.round(finite(startInput && startInput.value, model.start)), 1, years);
      var end = clamp(Math.round(finite(endInput && endInput.value, model.end)), 1, years);
      if (start > end) {
        if (document.activeElement === startInput) end = start;
        else start = end;
      }
      if (typeof window.setUnifiedChartRange === "function") {
        window.setUnifiedChartRange(start, end);
      } else {
        model.start = start;
        model.end = end;
        model.inspectedYear = clamp(model.inspectedYear, start, end);
        syncControls();
        requestRender();
      }
    }

    if (startInput) {
      startInput.addEventListener("change", readRangeInput);
      startInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") readRangeInput();
      });
    }
    if (endInput) {
      endInput.addEventListener("change", readRangeInput);
      endInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") readRangeInput();
      });
    }
    if (yearRange) {
      yearRange.addEventListener("input", function () {
        updateSelection(Number(yearRange.value), model.scenario);
      });
    }

    scenarioKeys.forEach(function (key) {
      var canvas = get("chart" + key.charAt(0).toUpperCase() + key.slice(1));
      if (!canvas) return;
      canvas.addEventListener("pointermove", function (event) {
        inspectFromPointer(event, key);
      }, { passive: true });
      canvas.addEventListener("pointerdown", function (event) {
        inspectFromPointer(event, key);
      }, { passive: true });
      canvas.addEventListener("keydown", function (event) {
        var step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
        var years = getYears();
        if (event.key === "Home") step = -Infinity;
        if (event.key === "End") step = Infinity;
        if (step === 0) return;
        event.preventDefault();
        var next = step === Infinity ? model.end : step === -Infinity ? model.start : clamp(model.inspectedYear + step, model.start, model.end);
        updateSelection(next, key);
        if (years < 1) return;
      });
      canvas.addEventListener("click", function () {
        updateSelection(model.inspectedYear, key);
      });
    });

    model.motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    model.reducedMotion = Boolean(model.motionQuery && model.motionQuery.matches);
    if (model.motionQuery) {
      var onMotion = function () {
        model.reducedMotion = Boolean(model.motionQuery.matches);
        if (model.reducedMotion) killAnimations();
        requestRender();
      };
      if (typeof model.motionQuery.addEventListener === "function") model.motionQuery.addEventListener("change", onMotion);
      else if (typeof model.motionQuery.addListener === "function") model.motionQuery.addListener(onMotion);
    }
    document.addEventListener("visibilitychange", function () {
      model.pageHidden = document.hidden;
      if (model.pageHidden) killAnimations();
      if (!model.pageHidden) requestRender();
    });
    window.addEventListener("pagehide", function () {
      model.pageHidden = true;
      killAnimations();
      if (model.renderFrame) window.cancelAnimationFrame(model.renderFrame);
      model.renderFrame = 0;
      model.renderQueued = false;
      if (model.resizeObserver) model.resizeObserver.disconnect();
      if (model.intersectionObserver) model.intersectionObserver.disconnect();
    });
    window.addEventListener("pageshow", function () {
      model.pageHidden = false;
      if (model.resizeObserver) model.resizeObserver.observe(root);
      if (model.intersectionObserver) model.intersectionObserver.observe(root);
      requestRender();
    });
    window.addEventListener("beforeprint", function () {
      model.printing = true;
      killAnimations();
      if (model.projection) renderLanes();
    });
    window.addEventListener("afterprint", function () {
      redrawLanesAfterPrintWhenScreenReturns();
    });
    if (typeof window.IntersectionObserver === "function") {
      model.intersectionObserver = new IntersectionObserver(function (entries) {
        var entry = entries[0];
        model.offscreen = Boolean(entry && !entry.isIntersecting);
        if (model.offscreen) killAnimations();
      }, { rootMargin: "80px 0px" });
      model.intersectionObserver.observe(root);
    }
    if (typeof window.ResizeObserver === "function") {
      model.resizeObserver = new ResizeObserver(function () { requestRender(); });
      model.resizeObserver.observe(root);
    } else {
      window.addEventListener("resize", requestRender, { passive: true });
    }
    model.listenersBound = true;
  }

  function redrawLanesAfterPrintWhenScreenReturns() {
    var printMedia = window.matchMedia ? window.matchMedia("print") : null;
    var checks = 0;
    var scheduled = false;
    var changeHandler = null;

    function removeMediaListener() {
      if (!printMedia || !changeHandler) return;
      if (printMedia.removeEventListener) printMedia.removeEventListener("change", changeHandler);
      else if (printMedia.removeListener) printMedia.removeListener(changeHandler);
      changeHandler = null;
    }

    function renderWhenScreenReturns() {
      if (printMedia && printMedia.matches) {
        if (checks < 60) {
          checks += 1;
          window.requestAnimationFrame(renderWhenScreenReturns);
        }
        return;
      }
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () {
        scheduled = false;
        if (printMedia && printMedia.matches) {
          renderWhenScreenReturns();
          return;
        }
        removeMediaListener();
        model.printing = false;
        if (model.projection) renderLanes();
      });
    }

    if (printMedia) {
      changeHandler = function (event) {
        if (!event.matches) renderWhenScreenReturns();
      };
      if (printMedia.addEventListener) printMedia.addEventListener("change", changeHandler);
      else if (printMedia.addListener) printMedia.addListener(changeHandler);
    }
    renderWhenScreenReturns();
  }

  function requestRender() {
    if (model.renderQueued || model.pageHidden) return;
    model.renderQueued = true;
    model.renderFrame = window.requestAnimationFrame(function () {
      model.renderFrame = 0;
      model.renderQueued = false;
      if (model.projection && !model.pageHidden) renderLanes();
    });
  }

  function updateSelection(year, scenario) {
    if (!model.projection) return;
    var nextYear = clamp(Math.round(finite(year, model.end)), model.start, model.end);
    var nextScenario = scenarioKeys.indexOf(scenario) >= 0 ? scenario : model.scenario;
    model.inspectedYear = nextYear;
    model.scenario = nextScenario;
    syncControls();
    requestRender();
  }

  function inspectFromPointer(event, scenario) {
    var canvas = event.currentTarget;
    var geometry = model.geometry[scenario];
    if (!canvas || !geometry || !geometry.rows.length) return;
    var rect = canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var index = clamp(Math.round((x - geometry.plotLeft - geometry.step / 2) / Math.max(1, geometry.step)), 0, geometry.rows.length - 1);
    updateSelection(geometry.rows[index].year, scenario);
  }

  function syncControls() {
    var years = getYears();
    var startInput = get("layeredRangeStart");
    var endInput = get("layeredRangeEnd");
    var yearRange = get("layeredYearRange");
    var yearOutput = get("layeredYearOutput");
    if (startInput) { startInput.max = String(years); startInput.value = String(model.start); }
    if (endInput) { endInput.max = String(years); endInput.value = String(model.end); }
    if (yearRange) {
      yearRange.min = String(model.start);
      yearRange.max = String(model.end);
      yearRange.value = String(model.inspectedYear);
      yearRange.setAttribute("aria-valuetext", "第 " + model.inspectedYear + " 年");
    }
    if (yearOutput) yearOutput.textContent = String(model.inspectedYear);
    setElementText("layeredRangeStartLabel", String(model.start));
    setElementText("layeredRangeEndLabel", String(model.end));
    var currency = model.context && model.context.currency ? model.context.currency : "USD";
    setElementText("layeredBarsCurrency", currency);
    setElementText("legacyChartCurrencyPill", currency);
    var minLabel = get("layeredYearMin");
    var maxLabel = get("layeredYearMax");
    if (minLabel) minLabel.textContent = "第 " + model.start + " 年";
    if (maxLabel) maxLabel.textContent = "第 " + model.end + " 年";
    var tickStart = get("layeredTickStart");
    var tickMid = get("layeredTickMid");
    var tickEnd = get("layeredTickEnd");
    var midpoint = Math.round((model.start + model.end) / 2);
    if (tickStart) tickStart.textContent = String(model.start);
    if (tickMid) tickMid.textContent = midpoint === model.start || midpoint === model.end ? "" : String(midpoint);
    if (tickEnd) tickEnd.textContent = String(model.end);
  }

  function buildDomain() {
    var maxValue = 0;
    var minValue = 0;
    scenarioKeys.forEach(function (key) {
      getVisibleRows(key).forEach(function (row) {
        var values = displayValues(row);
        var positive = 0;
        var negative = 0;
        componentMeta.forEach(function (component) {
          var value = finite(values[component.key]);
          if (value >= 0) positive += value;
          else negative += value;
        });
        maxValue = Math.max(maxValue, positive);
        minValue = Math.min(minValue, negative);
      });
    });
    var spread = Math.max(1, maxValue - minValue, Math.abs(maxValue), Math.abs(minValue));
    return {
      max: maxValue + spread * 0.08,
      min: minValue - spread * 0.08
    };
  }

  function yForValue(value, geometry) {
    return geometry.plotTop + (geometry.max - value) / Math.max(1, geometry.max - geometry.min) * geometry.plotHeight;
  }

  function drawSegment(context, x, width, y1, y2, color, alpha) {
    if (Math.abs(y2 - y1) < 0.35) return;
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.fillRect(x, Math.min(y1, y2), width, Math.max(1, Math.abs(y2 - y1)));
    context.globalAlpha = 1;
  }

  function drawLane(key, domain) {
    var canvas = get("chart" + key.charAt(0).toUpperCase() + key.slice(1));
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    /* Chromium dispatches beforeprint before responsive screen columns have
       settled at the physical page width. Match the print CSS A4 geometry. */
    var printContentWidth = Math.round((297 - 16) * 96 / 25.4);
    var printCanvasWidth = Math.floor(printContentWidth - (8 * 96 / 25.4) - 132 - 216 - (4 * 96 / 25.4));
    var width = model.printing
      ? printCanvasWidth
      : Math.max(120, Math.round(rect.width || canvas.clientWidth || 420));
    var height = model.printing ? 132 : Math.max(172, Math.round(rect.height || 196));
    var dpr = model.printing ? 1 : Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    var context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.font = "11px Noto Sans TC, Microsoft JhengHei, sans-serif";
    context.lineJoin = "round";
    var axisValues = [0, 1, 2, 3].map(function (index) {
      return domain.min + (domain.max - domain.min) * index / 3;
    });
    var axisLabelWidth = Math.max.apply(null, axisValues.map(function (value) {
      return context.measureText(formatAxis(value)).width;
    }));
    var padding = { top: 18, right: 10, bottom: 30, left: Math.ceil(axisLabelWidth) + 14 };
    var plotWidth = Math.max(60, width - padding.left - padding.right);
    var plotHeight = Math.max(80, height - padding.top - padding.bottom);
    var rows = getVisibleRows(key);
    var step = plotWidth / Math.max(1, rows.length);
    var barWidth = Math.max(3, Math.min(44, step * 0.66));
    var geometry = {
      rows: rows,
      width: width,
      height: height,
      plotLeft: padding.left,
      plotTop: padding.top,
      plotWidth: plotWidth,
      plotHeight: plotHeight,
      step: step,
      max: domain.max,
      min: domain.min
    };
    model.geometry[key] = geometry;
    var reportPrefix = key.charAt(0).toUpperCase() + key.slice(1);
    var selectedRow = rows.find(function (row) { return row.year === model.inspectedYear; });
    canvas.setAttribute("aria-describedby", "layered" + reportPrefix + "ReportYear layered" + reportPrefix + "Pnl");
    canvas.setAttribute("aria-label", scenarioMeta[key].label + "逐年資金分佈圖，目前檢視第 " + model.inspectedYear + " 年" + (selectedRow ? "，退出損益 " + formatMoney(displayValues(selectedRow).profit) : ""));

    context.strokeStyle = "rgba(14, 71, 84, .15)";
    context.lineWidth = 1;
    context.textAlign = "right";
    context.textBaseline = "middle";
    for (var grid = 0; grid <= 3; grid += 1) {
      var gridValue = axisValues[grid];
      var gridY = yForValue(gridValue, geometry);
      context.beginPath();
      context.moveTo(padding.left, gridY);
      context.lineTo(width - padding.right, gridY);
      context.stroke();
      context.fillStyle = "#6d8084";
      context.fillText(formatAxis(gridValue), padding.left - 9, gridY);
    }
    var zeroY = yForValue(0, geometry);
    context.strokeStyle = "rgba(11, 67, 82, .45)";
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(padding.left, zeroY);
    context.lineTo(width - padding.right, zeroY);
    context.stroke();

    var selectedIndex = rows.findIndex(function (row) { return row.year === model.inspectedYear; });
    if (selectedIndex < 0 && rows.length) selectedIndex = rows.length - 1;
    if (selectedIndex >= 0) {
      var selectedX = padding.left + step * selectedIndex + step / 2;
      context.fillStyle = "rgba(31, 191, 203, .09)";
      context.fillRect(Math.max(padding.left, selectedX - step * 0.48), padding.top - 8, Math.min(step * .96, plotWidth), plotHeight + 16);
      context.setLineDash([4, 4]);
      context.strokeStyle = "rgba(10, 181, 202, .9)";
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(selectedX, padding.top - 8);
      context.lineTo(selectedX, height - padding.bottom + 3);
      context.stroke();
      context.setLineDash([]);
    }

    rows.forEach(function (row, rowIndex) {
      var values = displayValues(row);
      var positiveCursor = 0;
      var negativeCursor = 0;
      var x = padding.left + step * rowIndex + (step - barWidth) / 2;
      componentMeta.forEach(function (component) {
        var value = finite(values[component.key]);
        if (value >= 0) {
          var yTop = yForValue(positiveCursor + value, geometry);
          var yBottom = yForValue(positiveCursor, geometry);
          drawSegment(context, x, barWidth, yTop, yBottom, component.color, row.year === model.inspectedYear ? 1 : .95);
          positiveCursor += value;
        } else {
          var negativeTop = yForValue(negativeCursor, geometry);
          var negativeBottom = yForValue(negativeCursor + value, geometry);
          drawSegment(context, x, barWidth, negativeTop, negativeBottom, component.negativeColor || "#c32f46", row.year === model.inspectedYear ? 1 : .95);
          negativeCursor += value;
        }
      });
      if (row.year === model.inspectedYear) {
        var markerY = yForValue(positiveCursor, geometry);
        context.beginPath();
        context.arc(x + barWidth / 2, clamp(markerY, padding.top - 1, height - padding.bottom + 1), 5.2, 0, Math.PI * 2);
        context.fillStyle = "#f5ffff";
        context.fill();
        context.strokeStyle = scenarioMeta[key].accent;
        context.lineWidth = 2;
        context.stroke();
      }
    });

    var labelSlots = Math.max(2, Math.floor(plotWidth / 54));
    var labelInterval = Math.max(1, Math.ceil(rows.length / labelSlots));
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillStyle = "#4c6971";
    rows.forEach(function (row, index) {
      if (index % labelInterval !== 0 && index !== rows.length - 1 && row.year !== model.inspectedYear) return;
      var x = padding.left + step * index + step / 2;
      context.fillText(String(row.year), x, height - padding.bottom + 9);
    });
  }

  function updateLaneReadout(key) {
    var row = getRows(key).find(function (candidate) { return candidate.year === model.inspectedYear; });
    if (!row) return;
    var values = displayValues(row);
    var prefix = key.charAt(0).toUpperCase() + key.slice(1);
    setElementText("layered" + prefix + "ReportYear", "第 " + row.year + " 年退出損益");
    setElementText("layered" + prefix + "Pnl", formatMoney(values.profit));
    setElementText("layered" + prefix + "Interest", formatLoan(row.cumulativeInterestUsd));
    setElementText("layered" + prefix + "Fee", formatLoan(row.cumulativeHandlingFeeUsd));
    setElementText("layered" + prefix + "Invested", formatMoney(values.invested));
    setElementText("layered" + prefix + "Principal", formatLoan(row.principalUsd));
    var pnl = get("layered" + prefix + "Pnl");
    if (pnl) {
      pnl.classList.toggle("is-positive", values.profit > 0);
      pnl.classList.toggle("is-negative", values.profit < 0);
    }
    var lane = root && root.querySelector("[data-scenario=\"" + key + "\"]");
    if (lane) lane.classList.toggle("is-selected", key === model.scenario);
  }

  function renderLanes() {
    if (!root || !model.projection || model.pageHidden) return;
    var domain = buildDomain();
    scenarioKeys.forEach(function (key) {
      drawLane(key, domain);
      updateLaneReadout(key);
    });
    var selectedRow = getRows(model.scenario).find(function (row) { return row.year === model.inspectedYear; });
    if (selectedRow) {
      root.setAttribute("data-inspected-year", String(model.inspectedYear));
      root.setAttribute("data-inspected-scenario", model.scenario);
      setElementText("layeredSelectionNote", "目前檢視：" + scenarioMeta[model.scenario].label + "・第 " + model.inspectedYear + " 年");
    }
    animateReveal();
  }

  function killAnimations() {
    if (window.gsap && model.animationTargets.length) {
      model.animationTargets.forEach(function (target) {
        window.gsap.killTweensOf(target);
        window.gsap.set(target, { clearProps: "opacity,transform" });
      });
    }
    model.animationTargets = [];
  }

  function animateReveal() {
    var currency = model.context && model.context.currency ? model.context.currency : "USD";
    var visualKey = model.start + ":" + model.end + ":" + currency;
    if (visualKey === model.lastVisualKey || model.reducedMotion || model.pageHidden || model.offscreen || model.printing) return;
    model.lastVisualKey = visualKey;
    var canvases = scenarioKeys.map(function (key) { return get("chart" + key.charAt(0).toUpperCase() + key.slice(1)); }).filter(Boolean);
    killAnimations();
    if (!window.gsap || !canvases.length) return;
    model.animationTargets = canvases;
    window.gsap.fromTo(canvases, { opacity: .4, y: 7 }, {
      opacity: 1,
      y: 0,
      duration: .28,
      stagger: .045,
      ease: "power2.out",
      clearProps: "opacity,transform"
    });
  }

  function render(projection, context) {
    if (!root) bind();
    if (!root) return;
    model.projection = projection;
    model.context = context || {};
    var years = getYears();
    var sharedRange = getSharedRange();
    if (!model.initialized) {
      model.start = sharedRange.start;
      model.end = sharedRange.end;
      model.inspectedYear = sharedRange.end;
      model.initialized = true;
    } else {
      model.start = sharedRange.start;
      model.end = sharedRange.end;
      model.start = clamp(model.start, 1, years);
      model.end = clamp(model.end, model.start, years);
      model.inspectedYear = clamp(model.inspectedYear, model.start, model.end);
    }
    syncControls();
    renderLanes();
  }

  function boot() {
    root = get("layeredBars");
    if (!root) return;
    bind();
  }

  window.AquariseBarCharts = {
    render: render,
    boot: boot,
    getState: function () {
      return { start: model.start, end: model.end, inspectedYear: model.inspectedYear, scenario: model.scenario };
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}());
