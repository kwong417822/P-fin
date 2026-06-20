"use strict";

const STORAGE_KEY = "premium-financing-calculator-v2";
const SCENARIOS = [
  { key: "low", label: "低息率", className: "low", color: "#2e5f8a" },
  { key: "base", label: "基本息率", className: "base", color: "#1e6f57" },
  { key: "high", label: "高息率", className: "high", color: "#b86f21" }
];

let state;
let els = {};

function initApp() {
  state = loadState();
  cacheElements();
  bindEvents();
  renderAll();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

function cacheElements() {
  els = {
    sampleBtn: document.getElementById("sampleBtn"),
    clearBtn: document.getElementById("clearBtn"),
    csvBtn: document.getElementById("csvBtn"),
    printBtn: document.getElementById("printBtn"),
    currencyLabel: document.getElementById("currencyLabel"),
    currencyToggle: document.getElementById("currencyToggle"),
    displayCurrency: document.getElementById("displayCurrency"),
    chartCurrencyPill: document.getElementById("chartCurrencyPill"),
    exchangeRateInput: document.getElementById("exchangeRateInput"),
    policyPriceInput: document.getElementById("policyPriceInput"),
    yearsInput: document.getElementById("yearsInput"),
    firstDaySurrenderInput: document.getElementById("firstDaySurrenderInput"),
    firstDaySurrenderRatioInput: document.getElementById("firstDaySurrenderRatioInput"),
    discountInput: document.getElementById("discountInput"),
    loanRatioInput: document.getElementById("loanRatioInput"),
    loanAmountInput: document.getElementById("loanAmountInput"),
    investedCapitalInput: document.getElementById("investedCapitalInput"),
    yearlyModeBtn: document.getElementById("yearlyModeBtn"),
    fixedModeBtn: document.getElementById("fixedModeBtn"),
    fixedLowInput: document.getElementById("fixedLowInput"),
    fixedBaseInput: document.getElementById("fixedBaseInput"),
    fixedHighInput: document.getElementById("fixedHighInput"),
    applyFixedBtn: document.getElementById("applyFixedBtn"),
    irrToggle: document.getElementById("irrToggle"),
    irrToggleText: document.getElementById("irrToggleText"),
    rateModeLabel: document.getElementById("rateModeLabel"),
    saveStatus: document.getElementById("saveStatus"),
    assumptionHint: document.getElementById("assumptionHint"),
    resultsHint: document.getElementById("resultsHint"),
    summaryGrid: document.getElementById("summaryGrid"),
    assumptionBody: document.getElementById("assumptionBody"),
    resultsTables: document.getElementById("resultsTables"),
    rangeInputs: {
      low: {
        start: document.getElementById("rangeLowStart"),
        end: document.getElementById("rangeLowEnd")
      },
      base: {
        start: document.getElementById("rangeBaseStart"),
        end: document.getElementById("rangeBaseEnd")
      },
      high: {
        start: document.getElementById("rangeHighStart"),
        end: document.getElementById("rangeHighEnd")
      }
    },
    chartCanvases: {
      low: document.getElementById("chartLow"),
      base: document.getElementById("chartBase"),
      high: document.getElementById("chartHigh")
    }
  };
}

function bindEvents() {
  els.sampleBtn.addEventListener("click", () => {
    state = createSampleState();
    renderAll();
  });

  els.clearBtn.addEventListener("click", () => {
    state = createBlankState();
    renderAll();
  });

  els.csvBtn.addEventListener("click", exportCsv);
  els.printBtn.addEventListener("click", () => window.print());

  els.currencyToggle.addEventListener("click", () => {
    state.currency = state.currency === "USD" ? "HKD" : "USD";
    renderAll();
  });

  els.exchangeRateInput.addEventListener("input", () => {
    const nextRate = readNumber(els.exchangeRateInput.value, state.exchangeRate);
    state.exchangeRate = nextRate > 0 ? nextRate : state.exchangeRate;
    renderAll({ keepExchangeInput: true });
  });

  els.policyPriceInput.addEventListener("input", () => {
    state.policyPriceUsd = Math.max(0, displayToUsd(readNumber(els.policyPriceInput.value, 0)));
    recalculateLinkedAmounts("policy");
    renderAll({ keepPolicyInput: true });
  });

  els.yearsInput.addEventListener("input", () => {
    const nextYears = clamp(Math.round(readNumber(els.yearsInput.value, state.years)), 1, 40);
    if (nextYears !== state.years) {
      state.years = nextYears;
      resizeProjectionArrays();
      normalizeChartRanges();
      renderAll();
    }
  });

  els.firstDaySurrenderInput.addEventListener("input", () => {
    state.firstDaySurrenderUsd = Math.max(0, displayToUsd(readNumber(els.firstDaySurrenderInput.value, 0)));
    recalculateLinkedAmounts("firstDaySurrender");
    renderAll({ keepFirstDayInput: true });
  });

  els.firstDaySurrenderRatioInput.addEventListener("input", () => {
    state.firstDaySurrenderRatio = Math.max(0, readNumber(els.firstDaySurrenderRatioInput.value, 0));
    recalculateLinkedAmounts("firstDaySurrenderRatio");
    renderAll({ keepFirstDaySurrenderRatioInput: true });
  });

  els.discountInput.addEventListener("input", () => {
    state.discountPercent = clamp(readNumber(els.discountInput.value, 0), 0, 100);
    recalculateLinkedAmounts("discount");
    renderAll({ keepDiscountInput: true });
  });

  els.loanRatioInput.addEventListener("input", () => {
    state.loanRatio = Math.max(0, readNumber(els.loanRatioInput.value, 0));
    recalculateLinkedAmounts("loanRatio");
    renderAll({ keepLoanRatioInput: true });
  });

  els.loanAmountInput.addEventListener("input", () => {
    state.loanAmountUsd = Math.max(0, displayToUsd(readNumber(els.loanAmountInput.value, 0)));
    recalculateLinkedAmounts("loanAmount");
    renderAll({ keepLoanAmountInput: true });
  });

  els.investedCapitalInput.addEventListener("input", () => {
    state.investedCapitalUsd = displayToUsd(readNumber(els.investedCapitalInput.value, 0));
    recalculateLinkedAmounts("investedCapital");
    renderAll({ keepInvestedCapitalInput: true });
  });

  document.querySelectorAll("[data-rate-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.rateMode = button.dataset.rateMode;
      renderAll();
    });
  });

  const syncFixedRatesFromInputs = () => {
    state.fixedRates.low = clamp(readRateValue(els.fixedLowInput.value, state.fixedRates.low), 0, 100);
    state.fixedRates.base = clamp(readRateValue(els.fixedBaseInput.value, state.fixedRates.base), 0, 100);
    state.fixedRates.high = clamp(readRateValue(els.fixedHighInput.value, state.fixedRates.high), 0, 100);
  };

  [els.fixedLowInput, els.fixedBaseInput, els.fixedHighInput].forEach((input) => {
    input.addEventListener("focus", () => {
      selectRateInput(input);
    });
    input.addEventListener("mouseup", (event) => {
      event.preventDefault();
      selectRateInput(input);
    });
    input.addEventListener("input", () => {
      syncFixedRatesFromInputs();
      renderOutputsAndSave();
    });
    input.addEventListener("blur", () => {
      syncFixedRatesFromInputs();
      renderAll();
    });
  });

  els.applyFixedBtn.addEventListener("click", () => {
    state.rateMode = "fixed";
    renderAll();
  });

  els.irrToggle.addEventListener("change", () => {
    state.showIrr = els.irrToggle.checked;
    renderAll();
  });

  els.assumptionBody.addEventListener("input", (event) => {
    const input = event.target;
    const index = Number(input.dataset.index);
    if (!Number.isInteger(index)) {
      return;
    }

    if (input.dataset.kind === "policy") {
      state.policyValuesUsd[index] = Math.max(0, displayToUsd(readNumber(input.value, 0)));
    }

    if (input.dataset.kind === "rate" && state.rateMode === "yearly") {
      const scenario = input.dataset.scenario;
      state.scenarioRates[scenario][index] = clamp(readRateValue(input.value, state.scenarioRates[scenario][index]), 0, 100);
    }

    renderOutputsAndSave();
  });

  els.assumptionBody.addEventListener("focusin", (event) => {
    const input = event.target;
    if (input.dataset.kind === "rate") {
      selectRateInput(input);
    }
  });

  els.assumptionBody.addEventListener("mouseup", (event) => {
    const input = event.target;
    if (input.dataset.kind === "rate") {
      event.preventDefault();
      selectRateInput(input);
    }
  });

  els.assumptionBody.addEventListener("focusout", (event) => {
    const input = event.target;
    const index = Number(input.dataset.index);
    if (input.dataset.kind !== "rate" || !Number.isInteger(index)) {
      return;
    }

    const scenario = input.dataset.scenario;
    if (state.scenarioRates[scenario]) {
      input.value = formatInputNumber(state.scenarioRates[scenario][index], 2);
    }
  });

  SCENARIOS.forEach((scenario) => {
    const range = els.rangeInputs[scenario.key];
    [range.start, range.end].forEach((input) => {
      input.addEventListener("input", () => {
        state.chartRanges[scenario.key].start = Math.round(readNumber(range.start.value, 1));
        state.chartRanges[scenario.key].end = Math.round(readNumber(range.end.value, state.years));
        normalizeChartRanges();
        renderOutputsAndSave();
      });
    });
  });

  window.addEventListener("resize", () => drawCharts(calculateProjection()));
}

function renderAll(options = {}) {
  normalizeState();
  renderInputs(options);
  renderRateMode();
  renderChartRangeInputs();
  renderAssumptionTable();
  renderOutputsAndSave();
}

function renderInputs(options = {}) {
  els.currencyLabel.textContent = state.currency;
  els.displayCurrency.textContent = state.currency;
  els.chartCurrencyPill.textContent = state.currency;
  els.currencyToggle.textContent = state.currency === "USD" ? "切換港幣" : "切回美金";
  els.irrToggle.checked = state.showIrr;
  els.irrToggleText.textContent = state.showIrr ? "顯示" : "隱藏";
  els.resultsHint.textContent = state.showIrr
    ? "IRR 與平均年回報以每個年度退出作試算"
    : "平均年回報以每個年度退出作試算";

  document.querySelectorAll(".currency-code").forEach((node) => {
    node.textContent = state.currency;
  });

  if (!options.keepExchangeInput) {
    els.exchangeRateInput.value = formatInputNumber(state.exchangeRate, 4);
  }
  if (!options.keepPolicyInput) {
    els.policyPriceInput.value = formatInputNumber(usdToDisplay(state.policyPriceUsd), 0);
  }
  if (!options.keepFirstDayInput) {
    els.firstDaySurrenderInput.value = formatInputNumber(usdToDisplay(state.firstDaySurrenderUsd), 0);
  }
  if (!options.keepFirstDaySurrenderRatioInput) {
    els.firstDaySurrenderRatioInput.value = formatInputNumber(state.firstDaySurrenderRatio, 2);
  }
  if (!options.keepDiscountInput) {
    els.discountInput.value = formatInputNumber(state.discountPercent, 2);
  }
  if (!options.keepLoanRatioInput) {
    els.loanRatioInput.value = formatInputNumber(state.loanRatio, 2);
  }
  if (!options.keepLoanAmountInput) {
    els.loanAmountInput.value = formatInputNumber(usdToDisplay(state.loanAmountUsd), 0);
  }
  if (!options.keepInvestedCapitalInput) {
    els.investedCapitalInput.value = formatInputNumber(usdToDisplay(state.investedCapitalUsd), 0);
  }

  els.yearsInput.value = String(state.years);
  if (!options.keepFixedRateInputs) {
    els.fixedLowInput.value = formatInputNumber(state.fixedRates.low, 2);
    els.fixedBaseInput.value = formatInputNumber(state.fixedRates.base, 2);
    els.fixedHighInput.value = formatInputNumber(state.fixedRates.high, 2);
  }
}

function renderRateMode() {
  els.yearlyModeBtn.classList.toggle("active", state.rateMode === "yearly");
  els.fixedModeBtn.classList.toggle("active", state.rateMode === "fixed");
  els.rateModeLabel.textContent = state.rateMode === "fixed" ? "固定年利率" : "逐年浮動息率";
  els.assumptionHint.textContent = state.rateMode === "fixed" ? "固定模式會鎖定逐年息率欄位" : "低息率、基本息率和高息率可逐年輸入";
}

function renderChartRangeInputs() {
  SCENARIOS.forEach((scenario) => {
    const range = state.chartRanges[scenario.key];
    const inputs = els.rangeInputs[scenario.key];
    inputs.start.max = String(state.years);
    inputs.end.max = String(state.years);
    inputs.start.value = String(range.start);
    inputs.end.value = String(range.end);
  });
}

function renderAssumptionTable() {
  const effectiveRates = getEffectiveRates();
  const disabled = state.rateMode === "fixed" ? "disabled" : "";
  const rows = [];

  for (let index = 0; index < state.years; index += 1) {
    rows.push(`
      <tr>
        <td>第 ${index + 1} 年</td>
        <td>
          <input type="number" inputmode="decimal" min="0" step="1000"
            data-kind="policy" data-index="${index}"
            value="${escapeAttr(formatInputNumber(usdToDisplay(state.policyValuesUsd[index]), 0))}">
        </td>
        <td>
          <input type="text" inputmode="decimal"
            data-kind="rate" data-scenario="low" data-index="${index}" ${disabled}
            value="${escapeAttr(formatInputNumber(effectiveRates.low[index], 2))}">
        </td>
        <td>
          <input type="text" inputmode="decimal"
            data-kind="rate" data-scenario="base" data-index="${index}" ${disabled}
            value="${escapeAttr(formatInputNumber(effectiveRates.base[index], 2))}">
        </td>
        <td>
          <input type="text" inputmode="decimal"
            data-kind="rate" data-scenario="high" data-index="${index}" ${disabled}
            value="${escapeAttr(formatInputNumber(effectiveRates.high[index], 2))}">
        </td>
      </tr>
    `);
  }

  els.assumptionBody.innerHTML = rows.join("");
}

function renderOutputsAndSave() {
  normalizeState();
  const projection = calculateProjection();
  renderSummary(projection);
  renderResultsTable(projection);
  drawCharts(projection);
  saveState();
}

function renderSummary(projection) {
  const cards = SCENARIOS.map((scenario) => {
    const data = projection.scenarios[scenario.key];
    const finalRow = data.rows[data.rows.length - 1] || createEmptyRow();
    const pnlClass = finalRow.exitPnlUsd >= 0 ? "positive" : "negative";
    const breakEven = data.breakEvenYear ? `第 ${data.breakEvenYear} 年` : "未達";
    const irrMetric = state.showIrr
      ? `
          <div>
            <span>期末 IRR</span>
            <strong>${formatPercent(finalRow.irrPercent)}</strong>
          </div>
        `
      : "";

    return `
      <article class="summary-card ${scenario.className}">
        <p class="scenario-name">${scenario.label}</p>
        <p class="summary-value ${pnlClass}">${formatMoney(finalRow.exitPnlUsd)}</p>
        <div class="summary-metrics">
          <div>
            <span>投入資金</span>
            <strong>${formatMoney(state.investedCapitalUsd)}</strong>
          </div>
          <div>
            <span>融資金額</span>
            <strong>${formatMoney(state.loanAmountUsd)}</strong>
          </div>
          <div>
            <span>累計利息</span>
            <strong>${formatMoney(data.cumulativeInterestUsd)}</strong>
          </div>
          <div>
            <span>損益平衡</span>
            <strong>${breakEven}</strong>
          </div>
          <div>
            <span>期末獲利</span>
            <strong>${formatMoney(finalRow.grossProfitUsd)}</strong>
          </div>
          <div>
            <span>平均年回報</span>
            <strong>${formatPercent(finalRow.averageAnnualReturnPercent)}</strong>
          </div>
          ${irrMetric}
        </div>
      </article>
    `;
  });

  els.summaryGrid.innerHTML = cards.join("");
}

function renderResultsTable(projection) {
  const tables = SCENARIOS.map((scenario) => {
    const rows = projection.scenarios[scenario.key].rows.map((row) => {
      const pnlClass = row.exitPnlUsd >= 0 ? "positive" : "negative";
      const irrCell = state.showIrr ? `<td>${formatPercent(row.irrPercent)}</td>` : "";
      return `
        <tr>
          <td>第 ${row.year} 年</td>
          <td>${formatInputNumber(row.ratePercent, 2)}%</td>
          <td>${formatMoney(row.policyValueUsd)}</td>
          <td>${formatMoney(row.principalUsd)}</td>
          <td>${formatMoney(row.cumulativeInterestUsd)}</td>
          <td>${formatMoney(row.averageMonthlyInterestUsd)}</td>
          <td class="${row.grossProfitUsd >= 0 ? "positive" : "negative"}">${formatMoney(row.grossProfitUsd)}</td>
          <td>${formatMoney(state.investedCapitalUsd)}</td>
          <td class="${pnlClass}">${formatMoney(row.exitPnlUsd)}</td>
          <td>${formatPercent(row.averageAnnualReturnPercent)}</td>
          ${irrCell}
        </tr>
      `;
    }).join("");
    const irrHeader = state.showIrr ? "<th>IRR</th>" : "";

    return `
      <article class="scenario-result ${scenario.className}">
        <div class="scenario-result-title">
          <h3>${scenario.label}</h3>
          <span>共 ${state.years} 年</span>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>年度</th>
                <th>利率</th>
                <th>保單價值</th>
                <th>融資金額</th>
                <th>累計利息</th>
                <th>平均月利息</th>
                <th>獲利</th>
                <th>投入資金</th>
                <th>退出損益</th>
                <th>平均年回報</th>
                ${irrHeader}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </article>
    `;
  });

  els.resultsTables.innerHTML = tables.join("");
}

function recalculateLinkedAmounts(source) {
  if (source === "policy" || source === "firstDaySurrenderRatio") {
    state.firstDaySurrenderUsd = state.policyPriceUsd * state.firstDaySurrenderRatio / 100;
    state.loanAmountUsd = state.firstDaySurrenderUsd * state.loanRatio / 100;
    state.investedCapitalUsd = calculateInvestedCapital();
    return;
  }

  if (source === "loanRatio" || source === "firstDaySurrender") {
    state.firstDaySurrenderRatio = calculateFirstDaySurrenderRatio();
    state.loanAmountUsd = state.firstDaySurrenderUsd * state.loanRatio / 100;
    state.investedCapitalUsd = calculateInvestedCapital();
    return;
  }

  if (source === "loanAmount") {
    state.loanRatio = state.firstDaySurrenderUsd > 0 ? state.loanAmountUsd / state.firstDaySurrenderUsd * 100 : 0;
    state.loanRatio = Math.max(0, state.loanRatio);
    state.firstDaySurrenderRatio = calculateFirstDaySurrenderRatio();
    state.investedCapitalUsd = calculateInvestedCapital();
    return;
  }

  if (source === "investedCapital") {
    const discountAmountUsd = calculateDiscountAmount();
    state.loanAmountUsd = Math.max(0, state.policyPriceUsd - discountAmountUsd - state.investedCapitalUsd);
    state.loanRatio = state.firstDaySurrenderUsd > 0 ? state.loanAmountUsd / state.firstDaySurrenderUsd * 100 : 0;
    state.loanRatio = Math.max(0, state.loanRatio);
    state.firstDaySurrenderRatio = calculateFirstDaySurrenderRatio();
    return;
  }

  state.firstDaySurrenderRatio = calculateFirstDaySurrenderRatio();
  state.investedCapitalUsd = calculateInvestedCapital();
}

function calculateInvestedCapital() {
  return state.policyPriceUsd - state.loanAmountUsd - calculateDiscountAmount();
}

function calculateFirstDaySurrenderRatio() {
  return state.policyPriceUsd > 0 ? state.firstDaySurrenderUsd / state.policyPriceUsd * 100 : 0;
}

function calculateDiscountAmount() {
  return state.policyPriceUsd * state.discountPercent / 100;
}

function calculateProjection() {
  const effectiveRates = getEffectiveRates();
  const projection = { scenarios: {} };

  SCENARIOS.forEach((scenario) => {
    let cumulativeInterestUsd = 0;
    let breakEvenYear = null;
    const rows = [];

    for (let index = 0; index < state.years; index += 1) {
      const year = index + 1;
      const ratePercent = effectiveRates[scenario.key][index] || 0;
      const annualInterestUsd = state.loanAmountUsd * ratePercent / 100;
      cumulativeInterestUsd += annualInterestUsd;
      const averageMonthlyInterestUsd = cumulativeInterestUsd / (year * 12);
      const policyValueUsd = state.policyValuesUsd[index] || 0;
      const principalUsd = state.loanAmountUsd;
      const grossProfitUsd = policyValueUsd - principalUsd - cumulativeInterestUsd;
      const netSurrenderUsd = policyValueUsd - principalUsd;
      const exitPnlUsd = netSurrenderUsd - state.investedCapitalUsd - cumulativeInterestUsd;
      const averageAnnualReturnPercent = calculateAverageAnnualReturnPercent(exitPnlUsd, year);
      const cashFlows = buildCashFlowsForExit(effectiveRates[scenario.key], index, netSurrenderUsd);
      const irrPercent = calculateIrrPercent(cashFlows);

      if (breakEvenYear === null && exitPnlUsd >= 0) {
        breakEvenYear = year;
      }

      rows.push({
        year,
        ratePercent,
        policyValueUsd,
        principalUsd,
        annualInterestUsd,
        cumulativeInterestUsd,
        averageMonthlyInterestUsd,
        grossProfitUsd,
        netSurrenderUsd,
        exitPnlUsd,
        averageAnnualReturnPercent,
        irrPercent
      });
    }

    projection.scenarios[scenario.key] = {
      rows,
      cumulativeInterestUsd,
      breakEvenYear
    };
  });

  return projection;
}

function calculateAverageAnnualReturnPercent(exitPnlUsd, year) {
  if (state.investedCapitalUsd <= 0 || year <= 0) {
    return null;
  }
  return exitPnlUsd / state.investedCapitalUsd / year * 100;
}

function buildCashFlowsForExit(rates, exitIndex, netSurrenderUsd) {
  const flows = [-state.investedCapitalUsd];

  for (let index = 0; index <= exitIndex; index += 1) {
    const interestUsd = state.loanAmountUsd * (rates[index] || 0) / 100;
    if (index === exitIndex) {
      flows.push(netSurrenderUsd - interestUsd);
    } else {
      flows.push(-interestUsd);
    }
  }

  return flows;
}

function calculateIrrPercent(cashFlows) {
  const hasPositive = cashFlows.some((value) => value > 0);
  const hasNegative = cashFlows.some((value) => value < 0);
  if (!hasPositive || !hasNegative) {
    return null;
  }

  const npv = (rate) => cashFlows.reduce((sum, cashFlow, index) => {
    return sum + cashFlow / Math.pow(1 + rate, index);
  }, 0);

  for (let left = -0.95; left < 5; left += 0.05) {
    let low = left;
    let high = left + 0.05;
    let lowValue = npv(low);
    let highValue = npv(high);

    if (!Number.isFinite(lowValue) || !Number.isFinite(highValue)) {
      continue;
    }
    if (Math.abs(lowValue) < 0.000001) {
      return low * 100;
    }
    if (lowValue * highValue > 0) {
      continue;
    }

    for (let step = 0; step < 80; step += 1) {
      const mid = (low + high) / 2;
      const midValue = npv(mid);
      if (Math.abs(midValue) < 0.000001) {
        return mid * 100;
      }
      if (lowValue * midValue <= 0) {
        high = mid;
        highValue = midValue;
      } else {
        low = mid;
        lowValue = midValue;
      }
    }
    return (low + high) / 2 * 100;
  }

  return null;
}

function drawCharts(projection) {
  SCENARIOS.forEach((scenario) => {
    drawScenarioChart(els.chartCanvases[scenario.key], projection.scenarios[scenario.key].rows, scenario);
  });
}

function drawScenarioChart(canvas, rows, scenario) {
  const context = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = 300;
  const ratio = window.devicePixelRatio || 1;

  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  const range = state.chartRanges[scenario.key];
  const visibleRows = rows.slice(range.start - 1, range.end);
  const padding = { top: 24, right: 18, bottom: 48, left: 78 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxPolicy = Math.max(...visibleRows.map((row) => usdToDisplay(row.policyValueUsd)), 1);
  const maxPositiveStack = Math.max(...visibleRows.map((row) => {
    const chartProfitUsd = getChartProfitUsd(row);
    const stackUsd = state.investedCapitalUsd + row.principalUsd + row.cumulativeInterestUsd + Math.max(chartProfitUsd, 0);
    return usdToDisplay(stackUsd);
  }), 1);
  const minProfit = Math.min(...visibleRows.map((row) => usdToDisplay(getChartProfitUsd(row))), 0);
  const maxValue = Math.max(maxPolicy, maxPositiveStack) * 1.08;
  const minValue = Math.min(0, minProfit * 1.15);
  const yForValue = (value) => padding.top + (maxValue - value) / (maxValue - minValue) * plotHeight;
  const zeroY = yForValue(0);

  context.font = "12px Microsoft JhengHei, Arial";
  context.lineWidth = 1;
  context.strokeStyle = "#dbe3dd";
  context.fillStyle = "#66706b";
  context.textAlign = "right";
  context.textBaseline = "middle";

  for (let index = 0; index <= 4; index += 1) {
    const value = minValue + (maxValue - minValue) * index / 4;
    const y = yForValue(value);
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    context.fillText(formatCompactDisplay(value), padding.left - 10, y);
  }

  context.strokeStyle = "#8d9891";
  context.beginPath();
  context.moveTo(padding.left, zeroY);
  context.lineTo(width - padding.right, zeroY);
  context.stroke();

  const gap = 10;
  const barWidth = Math.max(18, Math.min(48, (plotWidth - gap * Math.max(0, visibleRows.length - 1)) / Math.max(visibleRows.length, 1)));
  const totalBarSpace = barWidth * visibleRows.length + gap * Math.max(0, visibleRows.length - 1);
  let x = padding.left + Math.max(0, (plotWidth - totalBarSpace) / 2);

  const labelInterval = width < 420 ? Math.ceil(visibleRows.length / 5) : width < 560 ? Math.ceil(visibleRows.length / 7) : 1;

  visibleRows.forEach((row, rowIndex) => {
    const investedDisplay = usdToDisplay(state.investedCapitalUsd);
    const principalDisplay = usdToDisplay(row.principalUsd);
    const interestDisplay = usdToDisplay(row.cumulativeInterestUsd);
    const profitDisplay = usdToDisplay(getChartProfitUsd(row));
    let stackTop = 0;

    drawPositiveSegment(context, x, barWidth, yForValue, stackTop, investedDisplay, "#6c7f91");
    stackTop += investedDisplay;
    drawPositiveSegment(context, x, barWidth, yForValue, stackTop, principalDisplay, "#263b55");
    stackTop += principalDisplay;
    drawPositiveSegment(context, x, barWidth, yForValue, stackTop, interestDisplay, "#c07a2a");
    stackTop += interestDisplay;

    if (profitDisplay >= 0) {
      drawPositiveSegment(context, x, barWidth, yForValue, stackTop, profitDisplay, "#2f8b6d");
    } else {
      drawNegativeSegment(context, x, barWidth, yForValue, 0, profitDisplay, "#b44b4b");
    }

    context.fillStyle = "#66706b";
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillText(String(row.year), x + barWidth / 2, height - padding.bottom + 16);

    if (rowIndex % labelInterval === 0 || rowIndex === visibleRows.length - 1) {
      const labelY = Math.min(yForValue(Math.max(usdToDisplay(row.policyValueUsd), 0)) - 18, zeroY - 18);
      context.save();
      context.translate(x + barWidth / 2, Math.max(18, labelY));
      context.rotate(-Math.PI / 8);
      context.fillStyle = "#1d2522";
      context.font = width < 420 ? "10px Microsoft JhengHei, Arial" : "11px Microsoft JhengHei, Arial";
      context.fillText(formatCompactDisplay(usdToDisplay(row.policyValueUsd)), 0, 0);
      context.restore();
    }

    x += barWidth + gap;
  });

}

function getChartProfitUsd(row) {
  return row.policyValueUsd - state.investedCapitalUsd - row.principalUsd - row.cumulativeInterestUsd;
}

function drawPositiveSegment(context, x, width, yForValue, start, amount, color) {
  if (amount <= 0) {
    return;
  }
  const y1 = yForValue(start);
  const y2 = yForValue(start + amount);
  context.fillStyle = color;
  context.fillRect(x, y2, width, Math.max(1, y1 - y2));
}

function drawNegativeSegment(context, x, width, yForValue, start, amount, color) {
  if (amount >= 0) {
    return;
  }
  const y1 = yForValue(start);
  const y2 = yForValue(start + amount);
  context.fillStyle = color;
  context.fillRect(x, y1, width, Math.max(1, y2 - y1));
}

function drawLegend(context, x, y, items) {
  let cursor = x;
  items.forEach(([label, color]) => {
    context.fillStyle = color;
    context.fillRect(cursor, y, 10, 10);
    context.fillStyle = "#1d2522";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.font = "12px Microsoft JhengHei, Arial";
    context.fillText(label, cursor + 14, y + 5);
    cursor += Math.max(62, context.measureText(label).width + 28);
  });
}

function exportCsv() {
  const projection = calculateProjection();
  const currency = state.currency;
  const detailHeader = ["年度", "情境", "利率", `保單價值 (${currency})`, `融資金額 (${currency})`, `累計利息 (${currency})`, `平均月利息 (${currency})`, `獲利 (${currency})`, `投入資金 (${currency})`, `退出損益 (${currency})`, "平均年回報"];
  if (state.showIrr) {
    detailHeader.push("IRR");
  }
  const rows = [
    ["Aquarise專用保費融資計數機"],
    ["顯示貨幣", currency],
    ["USD/HKD 匯率", state.exchangeRate],
    ["保單價值", displayRaw(state.policyPriceUsd)],
    ["首日退保價格", displayRaw(state.firstDaySurrenderUsd)],
    ["首日退保價格成數", `${formatInputNumber(state.firstDaySurrenderRatio, 2)}%`],
    ["優惠", `${formatInputNumber(state.discountPercent, 2)}%`],
    ["優惠金額", displayRaw(calculateDiscountAmount())],
    ["融資比例", `${formatInputNumber(state.loanRatio, 2)}%`],
    ["融資金額", displayRaw(state.loanAmountUsd)],
    ["投入資金", displayRaw(state.investedCapitalUsd)],
    ["利率模式", state.rateMode === "fixed" ? "固定年利率" : "逐年浮動息率"],
    [],
    detailHeader
  ];

  for (let yearIndex = 0; yearIndex < state.years; yearIndex += 1) {
    SCENARIOS.forEach((scenario) => {
      const row = projection.scenarios[scenario.key].rows[yearIndex];
      const detailRow = [
        row.year,
        scenario.label,
        `${formatInputNumber(row.ratePercent, 2)}%`,
        displayRaw(row.policyValueUsd),
        displayRaw(row.principalUsd),
        displayRaw(row.cumulativeInterestUsd),
        displayRaw(row.averageMonthlyInterestUsd),
        displayRaw(row.grossProfitUsd),
        displayRaw(state.investedCapitalUsd),
        displayRaw(row.exitPnlUsd),
        formatPercent(row.averageAnnualReturnPercent)
      ];
      if (state.showIrr) {
        detailRow.push(formatPercent(row.irrPercent));
      }
      rows.push(detailRow);
    });
  }

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `premium-financing-${currency}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getEffectiveRates() {
  if (state.rateMode === "fixed") {
    return {
      low: Array.from({ length: state.years }, () => state.fixedRates.low),
      base: Array.from({ length: state.years }, () => state.fixedRates.base),
      high: Array.from({ length: state.years }, () => state.fixedRates.high)
    };
  }

  return {
    low: state.scenarioRates.low.slice(0, state.years),
    base: state.scenarioRates.base.slice(0, state.years),
    high: state.scenarioRates.high.slice(0, state.years)
  };
}

function resizeProjectionArrays() {
  state.policyValuesUsd = resizeNumberArray(state.policyValuesUsd, state.years, (index) => {
    if (index === 0) {
      return state.policyPriceUsd * 0.94;
    }
    const previous = state.policyValuesUsd[index - 1] || state.policyPriceUsd;
    return previous * 1.035;
  });

  SCENARIOS.forEach((scenario) => {
    const fallback = state.fixedRates[scenario.key] || 0;
    state.scenarioRates[scenario.key] = resizeNumberArray(state.scenarioRates[scenario.key], state.years, () => fallback);
  });
}

function resizeNumberArray(array, length, fallbackFactory) {
  const next = Array.isArray(array) ? array.slice(0, length) : [];
  while (next.length < length) {
    next.push(Number(fallbackFactory(next.length)) || 0);
  }
  return next;
}

function normalizeChartRanges() {
  state.chartRanges = state.chartRanges || {};
  SCENARIOS.forEach((scenario) => {
    const existing = state.chartRanges[scenario.key] || {};
    const defaultEnd = Math.min(state.years, 10);
    let start = clamp(Math.round(Number(existing.start) || 1), 1, state.years);
    let end = clamp(Math.round(Number(existing.end) || defaultEnd), 1, state.years);
    if (start > end) {
      [start, end] = [end, start];
    }
    state.chartRanges[scenario.key] = { start, end };
  });
}

function loadState() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return normalizeLoadedState(JSON.parse(stored));
    }
  } catch (error) {
    console.warn("Unable to load saved calculator state.", error);
  }
  return createSampleState();
}

function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    els.saveStatus.textContent = "已保存";
  } catch (error) {
    els.saveStatus.textContent = "未保存";
  }
}

function normalizeLoadedState(value) {
  const sample = createSampleState();
  return {
    ...sample,
    ...value,
    fixedRates: { ...sample.fixedRates, ...(value.fixedRates || {}) },
    chartRanges: { ...sample.chartRanges, ...(value.chartRanges || {}) },
    scenarioRates: {
      low: value.scenarioRates?.low || sample.scenarioRates.low,
      base: value.scenarioRates?.base || sample.scenarioRates.base,
      high: value.scenarioRates?.high || sample.scenarioRates.high
    },
    policyValuesUsd: value.policyValuesUsd || sample.policyValuesUsd
  };
}

function normalizeState() {
  state.currency = state.currency === "HKD" ? "HKD" : "USD";
  state.exchangeRate = Number(state.exchangeRate) > 0 ? Number(state.exchangeRate) : 7.8;
  state.years = clamp(Math.round(Number(state.years) || 20), 1, 40);
  state.policyPriceUsd = Math.max(0, Number(state.policyPriceUsd) || 0);
  state.firstDaySurrenderUsd = Math.max(0, Number(state.firstDaySurrenderUsd) || 0);
  state.firstDaySurrenderRatio = Number.isFinite(Number(state.firstDaySurrenderRatio))
    ? Math.max(0, Number(state.firstDaySurrenderRatio))
    : calculateFirstDaySurrenderRatio();
  state.discountPercent = clamp(Number(state.discountPercent) || 0, 0, 100);
  state.loanRatio = Math.max(0, Number(state.loanRatio) || 0);
  state.loanAmountUsd = Math.max(0, Number(state.loanAmountUsd) || 0);
  state.investedCapitalUsd = Number(state.investedCapitalUsd);
  if (!Number.isFinite(state.investedCapitalUsd)) {
    state.investedCapitalUsd = calculateInvestedCapital();
  }
  state.showIrr = state.showIrr !== false;
  state.rateMode = state.rateMode === "fixed" ? "fixed" : "yearly";
  state.fixedRates = state.fixedRates || { low: 4.5, base: 5.5, high: 7 };
  state.scenarioRates = state.scenarioRates || { low: [], base: [], high: [] };
  state.policyValuesUsd = Array.isArray(state.policyValuesUsd) ? state.policyValuesUsd.map((value) => Math.max(0, Number(value) || 0)) : [];

  SCENARIOS.forEach((scenario) => {
    state.fixedRates[scenario.key] = clamp(Number(state.fixedRates[scenario.key]) || 0, 0, 100);
    state.scenarioRates[scenario.key] = Array.isArray(state.scenarioRates[scenario.key])
      ? state.scenarioRates[scenario.key].map((value) => clamp(Number(value) || 0, 0, 100))
      : [];
  });

  resizeProjectionArrays();
  normalizeChartRanges();
}

function createSampleState() {
  const years = 20;
  const policyPriceUsd = 1000000;
  const firstDaySurrenderRatio = 88;
  const firstDaySurrenderUsd = policyPriceUsd * firstDaySurrenderRatio / 100;
  const loanRatio = 70;
  const loanAmountUsd = firstDaySurrenderUsd * loanRatio / 100;
  const discountPercent = 5;
  const investedCapitalUsd = policyPriceUsd - loanAmountUsd - policyPriceUsd * discountPercent / 100;

  const policyValuesUsd = Array.from({ length: years }, (_, index) => {
    const year = index + 1;
    return Math.round(policyPriceUsd * (0.92 + year * 0.025 + Math.pow(1.026, year) * 0.035));
  });

  return {
    currency: "USD",
    exchangeRate: 7.8,
    years,
    showIrr: true,
    policyPriceUsd,
    firstDaySurrenderUsd,
    firstDaySurrenderRatio,
    discountPercent,
    loanRatio,
    loanAmountUsd,
    investedCapitalUsd,
    rateMode: "yearly",
    fixedRates: {
      low: 4.5,
      base: 5.5,
      high: 7
    },
    chartRanges: {
      low: { start: 1, end: 10 },
      base: { start: 1, end: 10 },
      high: { start: 1, end: 10 }
    },
    policyValuesUsd,
    scenarioRates: {
      low: Array.from({ length: years }, (_, index) => roundTo(4.1 + Math.min(index, 8) * 0.04, 2)),
      base: Array.from({ length: years }, (_, index) => roundTo(5.1 + Math.min(index, 8) * 0.06, 2)),
      high: Array.from({ length: years }, (_, index) => roundTo(6.6 + Math.min(index, 8) * 0.09, 2))
    }
  };
}

function createBlankState() {
  const years = 20;
  return {
    currency: "USD",
    exchangeRate: 7.8,
    years,
    showIrr: true,
    policyPriceUsd: 0,
    firstDaySurrenderUsd: 0,
    firstDaySurrenderRatio: 0,
    discountPercent: 0,
    loanRatio: 0,
    loanAmountUsd: 0,
    investedCapitalUsd: 0,
    rateMode: "yearly",
    fixedRates: { low: 0, base: 0, high: 0 },
    chartRanges: {
      low: { start: 1, end: 10 },
      base: { start: 1, end: 10 },
      high: { start: 1, end: 10 }
    },
    policyValuesUsd: Array.from({ length: years }, () => 0),
    scenarioRates: {
      low: Array.from({ length: years }, () => 0),
      base: Array.from({ length: years }, () => 0),
      high: Array.from({ length: years }, () => 0)
    }
  };
}

function createEmptyRow() {
  return {
    exitPnlUsd: 0,
    grossProfitUsd: 0,
    averageAnnualReturnPercent: null,
    irrPercent: null
  };
}

function usdToDisplay(valueUsd) {
  return state.currency === "HKD" ? valueUsd * state.exchangeRate : valueUsd;
}

function displayToUsd(value) {
  return state.currency === "HKD" ? value / state.exchangeRate : value;
}

function formatMoney(valueUsd) {
  const value = usdToDisplay(valueUsd);
  const currency = state.currency;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
  return currency === "HKD" ? formatted.replace("HK$", "HK$ ") : formatted;
}

function displayRaw(valueUsd) {
  return roundTo(usdToDisplay(valueUsd), 2);
}

function formatCompactDisplay(value) {
  const abs = Math.abs(value);
  const prefix = value < 0 ? "-" : "";
  if (abs >= 1000000) {
    return `${prefix}${state.currency} ${(abs / 1000000).toFixed(1)}M`;
  }
  if (abs >= 1000) {
    return `${prefix}${state.currency} ${(abs / 1000).toFixed(0)}K`;
  }
  return `${prefix}${state.currency} ${abs.toFixed(0)}`;
}

function formatPercent(value) {
  return value === null || !Number.isFinite(value) ? "N/A" : `${formatInputNumber(value, 2)}%`;
}

function formatInputNumber(value, decimals) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }
  const rounded = roundTo(numeric, decimals);
  return decimals === 0 ? String(Math.round(rounded)) : rounded.toFixed(decimals);
}

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readRateValue(value, fallback) {
  const text = String(value ?? "")
    .trim()
    .replace(/[％%]/g, "")
    .replace(",", ".");
  if (text === "" || text === "." || text === "-") {
    return fallback;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function selectRateInput(input) {
  window.setTimeout(() => {
    input.select();
  }, 0);
}

function roundTo(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round((Number(value) || 0) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
