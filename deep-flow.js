(function () {
  "use strict";

  var els = {};
  var model = { projection: null, scenario: "base", year: 1, ready: false };
  var scenarioMeta = {
    low: { label: "低息率", color: "#9adbf4", accent: "#65b9db" },
    base: { label: "基本息率", color: "#54e0e1", accent: "#11aebb" },
    high: { label: "高息率", color: "#f5ae61", accent: "#e9964c" }
  };
  var scenarioKeys = ["low", "base", "high"];
  var chartDpr = 1;
  var chartGeometry = null;
  var lastReportPnl = null;
  var dialogReturnFocus = null;
  var isPrinting = false;
  var water = {
    canvas: null,
    context: null,
    program: null,
    texture: null,
    position: null,
    uv: null,
    time: null,
    ripple: null,
    progress: null,
    strength: null,
    aspect: null,
    frame: 0,
    startedAt: 0,
    active: false,
    visible: true,
    resizeObserver: null,
    intersectionObserver: null,
    motionQuery: null,
    imageReady: false,
    listenersBound: false,
    lastPointerStart: 0,
    uvScale: null,
    uvOffset: null,
    uvScaleLocation: null,
    uvOffsetLocation: null,
    shaderHandles: [],
    boundDown: null,
    boundMove: null,
    boundVisibility: null,
    boundPageHide: null,
    boundPageShow: null,
    boundMotion: null,
    boundContextLost: null,
    motionListenerBound: false,
    lifecycleListenerBound: false
  };

  function get(id) {
    return document.getElementById(id);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatMoney(value) {
    if (typeof formatDisplayMoney === "function") {
      return formatDisplayMoney(value);
    }
    return String(value);
  }

  function formatLoan(value) {
    if (typeof formatLoanMoney === "function") {
      return formatLoanMoney(value);
    }
    return formatMoney(value);
  }

  function formatPercentSafe(value) {
    if (typeof formatPercent === "function") {
      return formatPercent(value);
    }
    return Number.isFinite(value) ? String(Math.round(value * 100) / 100) + "%" : "N/A";
  }

  function displayPnl(row) {
    return typeof calculateDisplayExitPnl === "function" ? calculateDisplayExitPnl(row) : row.exitPnlUsd;
  }

  function getRows(key) {
    return model.projection && model.projection.scenarios && model.projection.scenarios[key]
      ? model.projection.scenarios[key].rows || []
      : [];
  }

  function currentRow(key) {
    var rows = getRows(key || model.scenario);
    return rows[clamp(model.year - 1, 0, Math.max(0, rows.length - 1))] || null;
  }

  function boot() {
    els = {
      policy: get("policyPriceInput"),
      loanRatio: get("loanRatioInput"),
      years: get("yearsInput"),
      loanRatioRange: get("deepLoanRatioRange"),
      yearsRange: get("deepYearsRange"),
      currencyUsd: get("deepCurrencyUSD"),
      currencyHkd: get("deepCurrencyHKD"),
      currencyToggle: get("currencyToggle"),
      advanced: get("deepAdvancedBtn"),
      dialog: get("advancedDialog"),
      dialogClose: get("deepDialogClose"),
      rateSelect: get("deepRateSelect"),
      scenarioCards: {
        low: get("deepScenarioLow"),
        base: get("deepScenarioBase"),
        high: get("deepScenarioHigh")
      },
      scenarioValues: {
        low: get("deepScenarioLowValue"),
        base: get("deepScenarioBaseValue"),
        high: get("deepScenarioHighValue")
      },
      reportYear: get("deepReportYear"),
      reportPnl: get("deepReportPnl"),
      reportInvested: get("deepReportInvested"),
      reportInterest: get("deepReportInterest"),
      flowToggle: get("deepFlowToggle"),
      flowToggleLabel: get("deepFlowToggleLabel"),
      reportFlow: get("deepReportFlow"),
      reportFlowList: get("deepReportFlowList"),
      yearRange: get("deepYearRange"),
      yearLabel: get("deepYearLabel"),
      ticks: [get("deepTick1"), get("deepTick2"), get("deepTick3"), get("deepTick4"), get("deepTick5")],
      chart: get("deepFlowChart"),
      chartStage: document.querySelector(".deep-chart-stage"),
      tooltip: get("deepChartTooltip"),
      tooltipYear: get("deepTooltipYear"),
      tooltipScenario: get("deepTooltipScenario"),
      tooltipValue: get("deepTooltipValue"),
      waterPanel: document.querySelector(".deep-water-panel"),
      waterStill: document.querySelector(".deep-water-still"),
      waterCanvas: get("deepWaterCanvas"),
      waterState: get("deepWaterState"),
      details: get("deep-details")
    };

    if (!els.chart || !els.yearRange) {
      return;
    }

    /* Keep the long legacy tables below the report grid after parsing so an open
       details section cannot stretch the compact right-hand report column. */
    var shell = document.querySelector(".deep-app-shell");
    if (shell && els.details && els.details.parentElement !== shell) {
      shell.appendChild(els.details);
      els.details.classList.add("deep-details-global");
    }

    document.addEventListener("aquarise:render", handleProjection);
    bindControls();
    setupWater();
    window.setTimeout(function () {
      if (typeof calculateProjection === "function") {
        try { handleProjection({ detail: calculateProjection() }); } catch (error) { /* app state will dispatch after init */ }
      }
    }, 0);
    window.addEventListener("resize", function () {
      drawChart();
      resizeWater();
      drawWater(1, 0);
    }, { passive: true });
  }

  function bindControls() {
    [els.currencyUsd, els.currencyHkd].forEach(function (button) {
      if (!button) return;
      button.addEventListener("click", function () {
        setCurrency(button.dataset.currency);
      });
    });

    if (els.loanRatioRange) {
      els.loanRatioRange.addEventListener("input", function () {
        if (!els.loanRatio) return;
        els.loanRatio.value = els.loanRatioRange.value;
        els.loanRatio.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    if (els.yearsRange) {
      els.yearsRange.addEventListener("input", function () {
        if (!els.years) return;
        els.years.value = els.yearsRange.value;
        els.years.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    if (els.rateSelect) {
      els.rateSelect.addEventListener("change", function () {
        setScenario(els.rateSelect.value);
      });
    }

    scenarioKeys.forEach(function (key) {
      if (els.scenarioCards[key]) {
        els.scenarioCards[key].addEventListener("click", function () {
          setScenario(key);
        });
      }
    });

    if (els.yearRange) {
      els.yearRange.addEventListener("input", function () {
        selectYear(Number(els.yearRange.value), false);
      });
    }

    if (els.flowToggle) {
      els.flowToggle.addEventListener("click", function () {
        var expanded = els.flowToggle.getAttribute("aria-expanded") === "true";
        els.flowToggle.setAttribute("aria-expanded", String(!expanded));
        els.reportFlow.hidden = expanded;
        if (els.flowToggleLabel) els.flowToggleLabel.textContent = expanded ? "展開現金流" : "收起現金流";
      });
    }

    if (els.advanced) {
      els.advanced.addEventListener("click", openDialog);
    }
    if (els.dialogClose) {
      els.dialogClose.addEventListener("click", closeDialog);
    }
    if (els.dialog) {
      els.dialog.addEventListener("click", function (event) {
        if (event.target === els.dialog) closeDialog();
      });
      els.dialog.addEventListener("cancel", function (event) {
        event.preventDefault();
        closeDialog();
      });
    }

    els.chart.addEventListener("pointermove", handleChartPointerMove, { passive: true });
    els.chart.addEventListener("pointerleave", hideTooltip, { passive: true });
    els.chart.addEventListener("click", function (event) {
      if (event.pointerType === "touch") return;
      handleChartPointerMove(event);
    }, { passive: true });

    if (els.details) {
      els.details.addEventListener("toggle", function () {
        if (els.details.open) {
          window.requestAnimationFrame(function () {
            if (typeof drawCharts === "function" && typeof calculateProjection === "function") {
              drawCharts(calculateProjection());
            }
          });
        }
      });
    }

    var printDetailsWasOpen = false;
    var printDialogWasOpen = false;
    var printMediaQuery = window.matchMedia ? window.matchMedia("print") : null;
    var printScreenRedrawPending = false;
    var printScreenRedrawScheduled = false;
    var printScreenRedrawChecks = 0;
    var printMediaChangeHandler = null;

    function redrawChartsAfterPrintWhenScreenReturns() {
      if (printScreenRedrawPending) return;
      printScreenRedrawPending = true;
      printScreenRedrawChecks = 0;

      function removePrintMediaListener() {
        if (!printMediaQuery || !printMediaChangeHandler) return;
        if (printMediaQuery.removeEventListener) printMediaQuery.removeEventListener("change", printMediaChangeHandler);
        else if (printMediaQuery.removeListener) printMediaQuery.removeListener(printMediaChangeHandler);
        printMediaChangeHandler = null;
      }

      function redrawIfScreenMedia() {
        if (printMediaQuery && printMediaQuery.matches) {
          if (printScreenRedrawChecks < 60) {
            printScreenRedrawChecks += 1;
            window.requestAnimationFrame(redrawIfScreenMedia);
          }
          return;
        }
        if (printScreenRedrawScheduled) return;
        printScreenRedrawScheduled = true;
        window.requestAnimationFrame(function () {
          printScreenRedrawScheduled = false;
          if (printMediaQuery && printMediaQuery.matches) {
            redrawIfScreenMedia();
            return;
          }
          removePrintMediaListener();
          printScreenRedrawPending = false;
          isPrinting = false;
          if (model.projection) drawChart();
          if (typeof drawCharts === "function" && typeof calculateProjection === "function") {
            try { drawCharts(calculateProjection()); } catch (error) { /* preserve the last rendered projection */ }
          }
        });
      }

      if (printMediaQuery) {
        printMediaChangeHandler = function (event) {
          if (!event.matches) redrawIfScreenMedia();
        };
        if (printMediaQuery.addEventListener) printMediaQuery.addEventListener("change", printMediaChangeHandler);
        else if (printMediaQuery.addListener) printMediaQuery.addListener(printMediaChangeHandler);
      }
      redrawIfScreenMedia();
    }

    window.addEventListener("beforeprint", function () {
      isPrinting = true;
      printDetailsWasOpen = Boolean(els.details && els.details.open);
      printDialogWasOpen = Boolean(els.dialog && els.dialog.open);
      if (printDialogWasOpen) closeDialog();
      if (els.details) els.details.open = true;
      renderPrintAssumptions(els.dialog);
      if (model.projection) drawChart();
      if (typeof drawCharts === "function" && typeof calculateProjection === "function") {
        try { drawCharts(calculateProjection()); } catch (error) { /* preserve the last rendered projection */ }
      }
    });
    window.addEventListener("afterprint", function () {
      if (els.details && !printDetailsWasOpen) els.details.open = false;
      if (printDialogWasOpen) openDialog();
      redrawChartsAfterPrintWhenScreenReturns();
    });
  }

  function setCurrency(currency) {
    var current = get("currencyLabel");
    if (!els.currencyToggle || !current || current.textContent === currency) {
      updateCurrencyButtons(currency);
      return;
    }
    els.currencyToggle.click();
  }

  function renderPrintAssumptions(dialog) {
    var shell = document.querySelector(".deep-app-shell");
    if (!dialog || !shell) return;
    var report = shell.querySelector(".deep-print-assumptions");
    if (!report) {
      report = document.createElement("section");
      report.className = "deep-print-assumptions";
      report.setAttribute("aria-label", "完整融資假設");
      report.hidden = true;
      shell.insertBefore(report, els.details || dialog);
    }
    report.replaceChildren();

    function inputValue(id) {
      var input = document.getElementById(id);
      return input ? input.value.trim() || "—" : "—";
    }

    function fieldLabel(id, fallback) {
      var input = document.getElementById(id);
      var label = input && input.closest("label");
      var text = label && label.querySelector(".field-label");
      return text ? text.textContent.trim().replace(/\s+/g, " ") : fallback;
    }

    function addGroup(title, entries) {
      var group = document.createElement("section");
      group.className = "deep-print-assumption-group";
      var heading = document.createElement("h3");
      heading.textContent = title;
      group.appendChild(heading);
      var list = document.createElement("dl");
      entries.forEach(function (entry) {
        var term = document.createElement("dt");
        var value = document.createElement("dd");
        term.textContent = entry[0];
        value.textContent = entry[1];
        list.appendChild(term);
        list.appendChild(value);
      });
      group.appendChild(list);
      groups.appendChild(group);
    }

    var title = document.createElement("h2");
    title.textContent = "完整融資假設";
    report.appendChild(title);
    var groups = document.createElement("div");
    groups.className = "deep-print-assumptions-grid";
    report.appendChild(groups);

    var isFixedRate = document.getElementById("fixedModeBtn");
    isFixedRate = Boolean(isFixedRate && isFixedRate.getAttribute("aria-pressed") === "true");
    var rateEntries = [["利率模式", isFixedRate ? "固定年利率" : "逐年浮動（見年度假設表）"]];
    [
      ["低息率固定年利率", "fixedLowInput"],
      ["基本息率固定年利率", "fixedBaseInput"],
      ["高息率固定年利率", "fixedHighInput"]
    ].forEach(function (item) {
      rateEntries.push([item[0] + (isFixedRate ? "" : "（未啟用）"), inputValue(item[1]) + "% p.a."]);
    });
    var irrToggle = document.getElementById("irrToggle");
    rateEntries.push(["IRR 顯示", irrToggle && irrToggle.checked ? "開啟" : "關閉"]);
    addGroup("利率與顯示", rateEntries);

    addGroup("其他融資假設", [
      [fieldLabel("exchangeRateInput", "保單 USD/HKD 匯率"), inputValue("exchangeRateInput")],
      [fieldLabel("loanExchangeRateInput", "融資額 USD/HKD 匯率"), inputValue("loanExchangeRateInput")],
      [fieldLabel("firstDaySurrenderInput", "首日退保價格"), inputValue("firstDaySurrenderInput")],
      [fieldLabel("firstDaySurrenderRatioInput", "首日退保價格成數"), inputValue("firstDaySurrenderRatioInput") + "%"],
      [fieldLabel("discountInput", "優惠"), inputValue("discountInput") + "%"],
      [fieldLabel("loanAmountInput", "融資額"), inputValue("loanAmountInput")],
      [fieldLabel("handlingFeeInput", "手續費"), inputValue("handlingFeeInput") + "% p.a."],
      [fieldLabel("investedCapitalInput", "投入資金"), inputValue("investedCapitalInput")]
    ]);
  }

  function updateCurrencyButtons(currency) {
    [els.currencyUsd, els.currencyHkd].forEach(function (button) {
      if (!button) return;
      var active = button.dataset.currency === currency;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setScenario(key) {
    if (scenarioKeys.indexOf(key) < 0) return;
    model.scenario = key;
    updateScenarioButtons();
    renderView();
  }

  function updateScenarioButtons() {
    scenarioKeys.forEach(function (key) {
      var active = key === model.scenario;
      var card = els.scenarioCards[key];
      if (card) {
        card.classList.toggle("is-active", active);
        card.setAttribute("aria-pressed", String(active));
      }
    });
    if (els.rateSelect) els.rateSelect.value = model.scenario;
  }

  function selectYear(year, showTooltip) {
    var rows = getRows(model.scenario);
    var max = Math.max(1, rows.length);
    model.year = clamp(Math.round(Number(year) || max), 1, max);
    syncYearControls();
    renderView();
    if (showTooltip) showTooltipFor(model.year, model.scenario);
  }

  function syncYearControls() {
    var max = Math.max(1, getRows("base").length || getRows(model.scenario).length || 20);
    if (els.yearRange) {
      els.yearRange.max = String(max);
      els.yearRange.value = String(clamp(model.year, 1, max));
    }
    if (els.yearLabel) els.yearLabel.textContent = String(model.year);
    if (els.reportYear) els.reportYear.textContent = String(model.year);
    var rawTicks = [1, Math.round(max * .25), Math.round(max * .5), Math.round(max * .75), max];
    var seenTicks = {};
    var tickValues = rawTicks.map(function (value) { var key = String(clamp(value, 1, max)); if (seenTicks[key]) return ""; seenTicks[key] = true; return key; });
    if (els.ticks) els.ticks.forEach(function (tick, index) { if (tick) tick.textContent = tickValues[index]; });
  }

  function syncPrimaryControls() {
    if (els.yearsRange && els.years) {
      els.yearsRange.max = els.years.max || "40";
      els.yearsRange.value = els.years.value || "20";
    }
    if (els.loanRatioRange && els.loanRatio) {
      var ratio = Number(els.loanRatio.value) || 0;
      var max = Math.max(100, Math.ceil(ratio / 10) * 10);
      els.loanRatioRange.max = String(max);
      els.loanRatioRange.value = String(clamp(ratio, 0, max));
    }
    var currency = get("currencyLabel");
    updateCurrencyButtons(currency ? currency.textContent : "USD");
    if (get("legacyChartCurrencyPill")) get("legacyChartCurrencyPill").textContent = currency ? currency.textContent : "USD";
    syncYearControls();
  }

  function handleProjection(event) {
    var projection = event && event.detail;
    if (!projection || !projection.scenarios) return;
    model.projection = projection;
    var max = getRows("base").length || getRows("low").length || 1;
    if (!model.ready) model.year = max;
    model.year = clamp(model.year, 1, max);
    model.ready = true;
    syncPrimaryControls();
    updateScenarioButtons();
    renderView();
  }

  function renderView() {
    if (!model.projection) return;
    syncYearControls();
    renderScenarioValues();
    renderReport();
    drawChart();
  }

  function renderScenarioValues() {
    scenarioKeys.forEach(function (key) {
      var row = currentRow(key);
      if (els.scenarioValues[key]) {
        var value = row ? displayPnl(row) : 0;
        els.scenarioValues[key].textContent = row ? formatMoney(value) : "—";
        els.scenarioValues[key].classList.toggle("is-positive", value > 0);
        els.scenarioValues[key].classList.toggle("is-negative", value < 0);
      }
    });
  }

  function renderReport() {
    var row = currentRow(model.scenario);
    if (!row) return;
    var effectiveRates = typeof getEffectiveRates === "function" ? getEffectiveRates() : null;
    var irr = effectiveRates && typeof calculateDisplayIrrPercent === "function"
      ? calculateDisplayIrrPercent(effectiveRates[model.scenario], model.year - 1)
      : null;
    var pnl = displayPnl(row);
    if (els.reportPnl) {
      els.reportPnl.textContent = formatMoney(pnl);
      els.reportPnl.classList.toggle("is-positive", pnl > 0);
      els.reportPnl.classList.toggle("is-negative", pnl < 0);
      els.reportPnl.style.fontSize = "";
      var reportBlock = els.reportPnl.parentElement;
      if (reportBlock && els.reportPnl.scrollWidth > reportBlock.clientWidth) {
        var baseSize = parseFloat(window.getComputedStyle(els.reportPnl).fontSize) || 52;
        els.reportPnl.style.fontSize = Math.max(34, baseSize * reportBlock.clientWidth / els.reportPnl.scrollWidth) + "px";
      }
    }
    if (els.reportInvested) els.reportInvested.textContent = typeof calculateInvestedCapitalDisplay === "function" ? formatMoney(calculateInvestedCapitalDisplay()) : "—";
    if (els.reportInterest) els.reportInterest.textContent = formatLoan(row.cumulativeInterestUsd);
    if (els.reportYear) els.reportYear.textContent = String(row.year);
    if (els.tooltipScenario) els.tooltipScenario.textContent = scenarioMeta[model.scenario].label;
    updateFlowList(row, irr);
    if (pnl !== lastReportPnl) {
      lastReportPnl = pnl;
      pulseReport();
    }
  }

  function updateFlowList(row, irr) {
    if (!els.reportFlowList) return;
    var invested = typeof calculateInvestedCapitalDisplay === "function" ? formatMoney(calculateInvestedCapitalDisplay()) : "—";
    var policy = typeof usdToDisplay === "function" ? formatDisplayMoney(usdToDisplay(row.policyValueUsd)) : formatMoney(row.policyValueUsd);
    var average = typeof calculateDisplayAverageAnnualReturnPercent === "function" ? calculateDisplayAverageAnnualReturnPercent(row) : row.averageAnnualReturnPercent;
    var entries = [["保單價值", policy], ["融資金額", formatLoan(row.principalUsd)], ["累計利息", formatLoan(row.cumulativeInterestUsd)], ["累計手續費", formatLoan(row.cumulativeHandlingFeeUsd)], ["投入資金", invested], ["平均年回報", formatPercentSafe(average)]];
    var irrToggle = get("irrToggle");
    if (!irrToggle || irrToggle.checked) entries.push(["期末 IRR", formatPercentSafe(irr)]);
    els.reportFlowList.innerHTML = entries.map(function (entry) { return "<dt>" + entry[0] + "</dt><dd>" + entry[1] + "</dd>"; }).join("");
  }

  function pulseReport() {
    if (!window.gsap || !els.reportPnl || !model.ready || (water.motionQuery && water.motionQuery.matches)) return;
    window.gsap.killTweensOf(els.reportPnl);
    window.gsap.set(els.reportPnl, { clearProps: "transform,opacity" });
    window.gsap.fromTo(els.reportPnl, { opacity: .72, y: 4 }, { opacity: 1, y: 0, duration: .2, ease: "power2.out", clearProps: "transform,opacity" });
  }

  function drawChart() {
    if (!model.projection || !els.chart) return;
    var rect = els.chart.getBoundingClientRect();
    /* beforeprint runs before Chromium expands responsive columns to the physical
       @page width, so use the fixed A4-landscape content geometry for the print bitmap. */
    var printContentWidth = Math.round((297 - 16) * 96 / 25.4);
    var printChartWidth = Math.floor(printContentWidth * 2.2 / (2.2 + 0.9));
    var width = isPrinting ? printChartWidth : Math.max(280, Math.floor(rect.width));
    var height = isPrinting ? 190 : Math.max(250, Math.floor(rect.height));
    chartDpr = isPrinting ? 1 : Math.min(2, window.devicePixelRatio || 1);
    els.chart.width = width * chartDpr;
    els.chart.height = height * chartDpr;
    var context = els.chart.getContext("2d");
    if (!context) return;
    context.setTransform(chartDpr, 0, 0, chartDpr, 0, 0);
    context.clearRect(0, 0, width, height);
    var allRows = getRows("base");
    var padding = { top: 20, right: 26, bottom: 31, left: width < 420 ? 43 : 61 };
    var plotWidth = width - padding.left - padding.right;
    var plotHeight = height - padding.top - padding.bottom;
    var values = [];
    scenarioKeys.forEach(function (key) { getRows(key).forEach(function (row) { values.push(displayPnl(row)); }); });
    var min = Math.min.apply(Math, values.concat([0]));
    var max = Math.max.apply(Math, values.concat([0]));
    var spread = Math.max(1, max - min);
    min -= spread * .1;
    max += spread * .1;
    chartGeometry = { width: width, height: height, padding: padding, plotWidth: plotWidth, plotHeight: plotHeight, min: min, max: max, rowCount: allRows.length };
    var xFor = function (index) { return padding.left + (allRows.length <= 1 ? plotWidth / 2 : index / (allRows.length - 1) * plotWidth); };
    var yFor = function (value) { return padding.top + (max - value) / (max - min) * plotHeight; };
    var gridColor = isPrinting ? "rgba(25, 55, 62, .18)" : "rgba(190, 244, 246, .18)";
    var labelColor = isPrinting ? "#465c61" : "rgba(224, 255, 255, .69)";
    var zeroColor = isPrinting ? "rgba(25, 55, 62, .55)" : "rgba(218, 255, 255, .4)";
    var yearColor = isPrinting ? "#334d53" : "rgba(232, 255, 255, .75)";
    context.font = "11px Noto Sans TC, Microsoft JhengHei, sans-serif";
    context.textAlign = "right";
    context.textBaseline = "middle";
    for (var grid = 0; grid <= 4; grid += 1) {
      var gridValue = min + (max - min) * grid / 4;
      var y = yFor(gridValue);
      context.beginPath(); context.moveTo(padding.left, y); context.lineTo(width - padding.right, y);
      context.strokeStyle = gridColor; context.lineWidth = 1; context.stroke();
      context.fillStyle = labelColor; context.fillText(formatChartValue(gridValue), padding.left - 9, y);
    }
    context.beginPath(); context.moveTo(padding.left, yFor(0)); context.lineTo(width - padding.right, yFor(0)); context.strokeStyle = zeroColor; context.stroke();
    scenarioKeys.forEach(function (key) {
      var rows = getRows(key);
      var active = key === model.scenario;
      context.beginPath();
      rows.forEach(function (row, index) { var x = xFor(index); var y = yFor(displayPnl(row)); if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); });
      context.strokeStyle = scenarioMeta[key].color; context.globalAlpha = active ? 1 : .85; context.lineWidth = active ? 3 : 2; context.stroke(); context.globalAlpha = 1;
      rows.forEach(function (row, index) {
        var x = xFor(index); var y = yFor(displayPnl(row));
        context.beginPath(); context.arc(x, y, index === model.year - 1 ? (active ? 6 : 4) : (active ? 3.2 : 2), 0, Math.PI * 2);
        context.fillStyle = scenarioMeta[key].color; context.globalAlpha = active || index === model.year - 1 ? 1 : .72; context.fill(); context.globalAlpha = 1;
        if (index === model.year - 1) { context.beginPath(); context.arc(x, y, active ? 9 : 7, 0, Math.PI * 2); context.strokeStyle = isPrinting ? "#253f46" : "#f3ffff"; context.lineWidth = 2; context.stroke(); }
      });
    });
    context.fillStyle = yearColor; context.textAlign = "center"; context.textBaseline = "top";
    [0, 4, 9, 14, allRows.length - 1].forEach(function (index) { if (index < 0 || index >= allRows.length) return; context.fillText(String(allRows[index].year), xFor(index), height - padding.bottom + 11); });
  }

  function formatChartValue(value) {
    var abs = Math.abs(value); var prefix = value < 0 ? "-" : "";
    if (abs >= 1000000) return prefix + (abs / 1000000).toFixed(1) + "M";
    if (abs >= 1000) return prefix + Math.round(abs / 1000) + "K";
    return prefix + Math.round(abs);
  }

  function chartPosition(event) {
    var rect = els.chart.getBoundingClientRect(); var rows = getRows("base"); var geometry = chartGeometry;
    if (!rows.length || !geometry) return { index: 0, x: 0, y: 0 };
    var localX = event.clientX - rect.left; var localY = event.clientY - rect.top;
    var plotX = clamp(localX - geometry.padding.left, 0, geometry.plotWidth);
    var index = clamp(Math.round(plotX / Math.max(1, geometry.plotWidth) * (rows.length - 1)), 0, rows.length - 1);
    return { index: index, x: localX, y: localY };
  }

  function handleChartPointerMove(event) {
    if (event.pointerType === "touch") return;
    var point = chartPosition(event); var nearest = model.scenario;
    var nextYear = point.index + 1;
    if (nextYear !== model.year) { model.year = nextYear; renderView(); }
    showTooltipFor(nextYear, nearest, point.x, point.y);
  }

  function showTooltipFor(year, key, x, y) {
    if (!els.tooltip) return;
    var row = getRows(key)[clamp(year - 1, 0, getRows(key).length - 1)]; if (!row) return;
    els.tooltipYear.textContent = "第 " + row.year + " 年"; els.tooltipScenario.textContent = scenarioMeta[key].label; els.tooltipValue.textContent = formatMoney(displayPnl(row));
    els.tooltip.hidden = false;
    if (typeof x !== "number" || !els.chartStage) return;
    var left = clamp(x + 16, 8, Math.max(8, els.chartStage.clientWidth - 166)); var top = clamp(y - 52, 8, Math.max(8, els.chartStage.clientHeight - 92));
    els.tooltip.style.left = left + "px"; els.tooltip.style.top = top + "px";
  }

  function hideTooltip() { if (els.tooltip) els.tooltip.hidden = true; }

  function openDialog() {
    if (!els.dialog) return;
    dialogReturnFocus = document.activeElement;
    if (typeof els.dialog.showModal === "function") els.dialog.showModal();
    else els.dialog.setAttribute("open", "open");
    var firstField = els.dialog.querySelector("input, select, button");
    if (firstField) window.setTimeout(function () { firstField.focus(); }, 0);
  }

  function closeDialog() {
    if (!els.dialog) return;
    if (typeof els.dialog.close === "function" && els.dialog.open) els.dialog.close();
    else els.dialog.removeAttribute("open");
    var returnFocus = dialogReturnFocus;
    dialogReturnFocus = null;
    if (returnFocus && typeof returnFocus.focus === "function") window.setTimeout(function () { returnFocus.focus(); }, 0);
  }

  function setupWater() {
    if (!els.waterCanvas || !els.waterPanel || !els.waterStill || water.listenersBound) return;
    water.canvas = els.waterCanvas;
    if (!water.motionQuery) water.motionQuery = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : { matches: false, addEventListener: function () {}, removeEventListener: function () {} };
    water.boundDown = handleWaterPointerDown;
    water.boundMove = handleWaterPointerMove;
    water.boundVisibility = function () { if (document.visibilityState === "hidden") stopWater(); };
    water.boundPageHide = function () { destroyWater(); };
    water.boundPageShow = function (event) { if (event.persisted) setupWater(); };
    water.boundMotion = water.boundMotion || function (event) {
      if (event.matches) {
        if (window.gsap && els.reportPnl) { window.gsap.killTweensOf(els.reportPnl); window.gsap.set(els.reportPnl, { clearProps: "transform,opacity" }); }
        destroyWater(true);
      } else {
        setupWater();
      }
    };
    water.boundContextLost = function (event) { event.preventDefault(); destroyWater(); };
    water.listenersBound = true;
    els.waterPanel.addEventListener("pointerdown", water.boundDown, { passive: true });
    els.waterPanel.addEventListener("pointermove", water.boundMove, { passive: true });
    water.canvas.addEventListener("webglcontextlost", water.boundContextLost, { passive: false });
    els.waterStill.addEventListener("load", initWaterGl, { once: true });
    if (els.waterStill.complete) initWaterGl();
    water.resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(resizeWater) : null;
    if (water.resizeObserver) water.resizeObserver.observe(els.waterPanel);
    water.intersectionObserver = typeof IntersectionObserver === "function" ? new IntersectionObserver(function (entries) { water.visible = entries.some(function (entry) { return entry.isIntersecting; }); if (!water.visible) stopWater(); }, { threshold: .05 }) : null;
    if (water.intersectionObserver) water.intersectionObserver.observe(els.waterPanel);
    if (!water.motionListenerBound && water.motionQuery.addEventListener) { water.motionQuery.addEventListener("change", water.boundMotion); water.motionListenerBound = true; }
    document.addEventListener("visibilitychange", water.boundVisibility);
    if (!water.lifecycleListenerBound) { window.addEventListener("pagehide", water.boundPageHide); window.addEventListener("pageshow", water.boundPageShow); water.lifecycleListenerBound = true; }
    if (water.motionQuery.matches || !window.WebGLRenderingContext) { setWaterState("still"); }
  }

  function compileShader(context, type, source) { var shader = context.createShader(type); context.shaderSource(shader, source); context.compileShader(shader); return context.getShaderParameter(shader, context.COMPILE_STATUS) ? shader : null; }

  function initWaterGl() {
    if (water.context || !water.canvas || !els.waterStill.complete || water.motionQuery.matches || !window.WebGLRenderingContext) return;
    var context = null;
    try {
      context = water.canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
      if (!context) throw new Error("WebGL unavailable");
      var vertex = compileShader(context, context.VERTEX_SHADER, "attribute vec2 a_position; attribute vec2 a_uv; varying vec2 v_uv; void main(){ v_uv=a_uv; gl_Position=vec4(a_position,0.0,1.0); }");
      var fragment = compileShader(context, context.FRAGMENT_SHADER, "precision mediump float; uniform sampler2D u_texture; uniform float u_progress; uniform float u_strength; uniform vec2 u_ripple; uniform float u_aspect; uniform vec2 u_uvScale; uniform vec2 u_uvOffset; varying vec2 v_uv; void main(){ vec2 delta=v_uv-u_ripple; delta.x*=u_aspect; float distanceFromRipple=length(delta); float wave=sin(distanceFromRipple*38.0-u_progress*15.0)*exp(-distanceFromRipple*8.0)*max(0.0,1.0-u_progress)*u_strength; vec2 direction=normalize(delta+vec2(0.0001)); vec2 uv=v_uv-direction*wave*0.012; uv=uv*u_uvScale+u_uvOffset; gl_FragColor=texture2D(u_texture,uv); }");
      if (!vertex || !fragment) throw new Error("WebGL shader compilation failed");
      var program = context.createProgram(); context.attachShader(program, vertex); context.attachShader(program, fragment); context.linkProgram(program); if (!context.getProgramParameter(program, context.LINK_STATUS)) throw new Error("WebGL program link failed");
      water.context = context; water.program = program; water.shaderHandles = [vertex, fragment]; water.position = context.getAttribLocation(program, "a_position"); water.uv = context.getAttribLocation(program, "a_uv"); water.time = context.getUniformLocation(program, "u_progress"); water.strength = context.getUniformLocation(program, "u_strength"); water.ripple = context.getUniformLocation(program, "u_ripple"); water.aspect = context.getUniformLocation(program, "u_aspect"); water.uvScaleLocation = context.getUniformLocation(program, "u_uvScale"); water.uvOffsetLocation = context.getUniformLocation(program, "u_uvOffset");
      var positionBuffer = context.createBuffer(); context.bindBuffer(context.ARRAY_BUFFER, positionBuffer); context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), context.STATIC_DRAW); water.positionBuffer = positionBuffer;
      var uvBuffer = context.createBuffer(); context.bindBuffer(context.ARRAY_BUFFER, uvBuffer); context.bufferData(context.ARRAY_BUFFER, new Float32Array([0,0,1,0,0,1,1,1]), context.STATIC_DRAW); water.uvBuffer = uvBuffer;
      var texture = context.createTexture(); context.bindTexture(context.TEXTURE_2D, texture); context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, true); context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE); context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE); context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR); context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR); context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, els.waterStill); water.texture = texture;
      water.imageReady = true; els.waterPanel.dataset.waterReady = "true"; setWaterState("ready"); resizeWater(); drawWater(1, 0);
    } catch (error) {
      if (context && context.getExtension) { try { context.getExtension("WEBGL_lose_context"); } catch (ignored) {} }
      destroyWater(); setWaterState("still");
    }
  }

  function resizeWater() {
    if (!water.context || !els.waterPanel) return;
    var rect = els.waterPanel.getBoundingClientRect(); var dpr = Math.min(1.5, window.devicePixelRatio || 1);
    water.canvas.width = Math.max(1, Math.floor(rect.width * dpr)); water.canvas.height = Math.max(1, Math.floor(rect.height * dpr)); water.context.viewport(0, 0, water.canvas.width, water.canvas.height);
    var imageAspect = els.waterStill.naturalWidth / Math.max(1, els.waterStill.naturalHeight); var canvasAspect = rect.width / Math.max(1, rect.height);
    if (canvasAspect > imageAspect) { var visibleV = imageAspect / canvasAspect; water.uvScale = [1, visibleV]; water.uvOffset = [0, (1 - visibleV) / 2]; }
    else { var visibleU = canvasAspect / imageAspect; water.uvScale = [visibleU, 1]; water.uvOffset = [(1 - visibleU) / 2, 0]; }
  }

  function startWaterRipple(event) { if (!water.context || !water.visible || water.motionQuery.matches) return; var rect = water.canvas.getBoundingClientRect(); water.rippleX = clamp((event.clientX - rect.left) / rect.width, 0, 1); water.rippleY = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1); water.startedAt = performance.now(); water.lastPointerStart = water.startedAt; water.active = true; setWaterState("ripple"); if (window.gsap) { window.gsap.killTweensOf(els.waterPanel); window.gsap.fromTo(els.waterPanel, { "--deep-ripple-glow": 0 }, { "--deep-ripple-glow": 1, duration: .18, yoyo: true, repeat: 1, ease: "sine.inOut" }); } scheduleWater(); }
  function handleWaterPointerDown(event) { startWaterRipple(event); }
  function handleWaterPointerMove(event) { if (!water.context || event.pointerType === "touch") return; var now = performance.now(); if (!water.active && now - water.lastPointerStart > 1800) startWaterRipple(event); if (!water.context) return; var rect = water.canvas.getBoundingClientRect(); water.rippleX = clamp((event.clientX - rect.left) / rect.width, 0, 1); water.rippleY = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1); }
  function scheduleWater() { if (!water.frame) water.frame = window.requestAnimationFrame(waterFrame); }
  function waterFrame(now) { water.frame = 0; if (!water.context || !water.active || !water.visible || document.visibilityState === "hidden") return; var progress = clamp((now - water.startedAt) / 1450, 0, 1); drawWater(progress, 1 - progress); if (progress < 1) scheduleWater(); else { water.active = false; setWaterState("ready"); } }
  function drawWater(progress, strength) { if (!water.context || !water.program) return; var context = water.context; context.useProgram(water.program); context.bindBuffer(context.ARRAY_BUFFER, water.positionBuffer); context.enableVertexAttribArray(water.position); context.vertexAttribPointer(water.position, 2, context.FLOAT, false, 0, 0); context.bindBuffer(context.ARRAY_BUFFER, water.uvBuffer); context.enableVertexAttribArray(water.uv); context.vertexAttribPointer(water.uv, 2, context.FLOAT, false, 0, 0); context.activeTexture(context.TEXTURE0); context.bindTexture(context.TEXTURE_2D, water.texture); context.uniform1i(context.getUniformLocation(water.program, "u_texture"), 0); context.uniform1f(water.time, progress); context.uniform1f(water.strength, strength); context.uniform2f(water.ripple, water.rippleX || .5, water.rippleY || .72); context.uniform1f(water.aspect, water.canvas.width / Math.max(1, water.canvas.height)); var scale = water.uvScale || [1, 1]; var offset = water.uvOffset || [0, 0]; context.uniform2f(water.uvScaleLocation, scale[0], scale[1]); context.uniform2f(water.uvOffsetLocation, offset[0], offset[1]); context.drawArrays(context.TRIANGLE_STRIP, 0, 4); }
  function stopWater() { water.active = false; if (water.frame) { window.cancelAnimationFrame(water.frame); water.frame = 0; } if (water.context) drawWater(1, 0); if (els.waterState && els.waterState.dataset.waterState === "ripple") setWaterState("paused"); }
  function destroyWater(preserveMotion) {
    stopWater();
    if (window.gsap && els.waterPanel) window.gsap.killTweensOf(els.waterPanel);
    if (water.boundDown && els.waterPanel) { els.waterPanel.removeEventListener("pointerdown", water.boundDown); els.waterPanel.removeEventListener("pointermove", water.boundMove); }
    if (water.boundContextLost && water.canvas) water.canvas.removeEventListener("webglcontextlost", water.boundContextLost);
    if (water.resizeObserver) water.resizeObserver.disconnect(); if (water.intersectionObserver) water.intersectionObserver.disconnect();
    if (!preserveMotion && water.motionQuery && water.motionQuery.removeEventListener && water.boundMotion) { water.motionQuery.removeEventListener("change", water.boundMotion); water.motionListenerBound = false; }
    if (water.boundVisibility) document.removeEventListener("visibilitychange", water.boundVisibility);
    if (water.context) {
      if (water.texture) water.context.deleteTexture(water.texture);
      if (water.positionBuffer) water.context.deleteBuffer(water.positionBuffer);
      if (water.uvBuffer) water.context.deleteBuffer(water.uvBuffer);
      water.shaderHandles.forEach(function (shader) { water.context.deleteShader(shader); });
      if (water.program) water.context.deleteProgram(water.program);
    }
    water.context = null; water.texture = null; water.program = null; water.positionBuffer = null; water.uvBuffer = null; water.shaderHandles = []; water.listenersBound = false; water.imageReady = false;
    if (els.waterPanel) { els.waterPanel.dataset.waterReady = "false"; setWaterState("still"); }
  }
  function setWaterState(state) { if (els.waterState) els.waterState.dataset.waterState = state; if (els.waterPanel) els.waterPanel.dataset.waterState = state; }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
}());
