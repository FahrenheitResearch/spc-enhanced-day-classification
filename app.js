const riskOrder = { ENH: 1, MDT: 2, HIGH: 3 };
const regimeOrder = { core: 1, likely: 2, possible: 3, none: 4 };
let records = [];
let filtered = [];
let selectedDay = null;
let activePreset = "";

const $ = (id) => document.getElementById(id);
const formatClass = (value) => value.replaceAll("_", " ");
const listText = (items, limit = 3) => (items || []).slice(0, limit).map(formatClass).join(", ");

function countBy(items, getter) {
  return items.reduce((acc, item) => {
    const key = getter(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function optionize(select, values, formatter = (x) => x) {
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = formatter(value);
    select.appendChild(option);
  }
}

function matchesSearch(record, query) {
  if (!query) return true;
  const haystack = [
    record.day,
    record.risk,
    record.primary,
    record.ofb,
    record.narrative,
    record.ofb_reason,
    ...(record.secondary || []),
    ...(record.tags || []),
    ...(record.boundaries || []),
    ...(record.modes || []),
    ...(record.hazards || []),
    ...(record.challenges || []),
  ].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function applyFilters() {
  const year = $("yearFilter").value;
  const risk = $("riskFilter").value;
  const ofb = $("ofbFilter").value;
  const primary = $("classFilter").value;
  const query = $("searchBox").value.trim();
  filtered = records.filter((record) => {
    const presetOk = activePreset === "corelikely" ? ["core", "likely"].includes(record.ofb) : true;
    return (!year || record.day.startsWith(year)) &&
      (!risk || record.risk === risk) &&
      (!ofb || record.ofb === ofb) &&
      (!primary || record.primary === primary) &&
      presetOk &&
      matchesSearch(record, query);
  }).sort((a, b) => b.day.localeCompare(a.day));
  render();
}

function renderMetrics() {
  const coreLikely = filtered.filter((r) => r.ofb === "core" || r.ofb === "likely").length;
  const high = filtered.filter((r) => r.risk === "HIGH").length;
  $("metricDays").textContent = filtered.length.toLocaleString();
  $("metricCoreLikely").textContent = coreLikely.toLocaleString();
  $("metricHigh").textContent = high.toLocaleString();
  $("visibleCount").textContent = `${filtered.length.toLocaleString()} visible`;
}

function renderClassChart() {
  const counts = Object.entries(countBy(filtered, (r) => r.primary))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14);
  const max = Math.max(1, ...counts.map(([, count]) => count));
  $("classChart").innerHTML = counts.map(([name, count]) => `
    <div class="bar-row" title="${formatClass(name)}">
      <div class="bar-label">${formatClass(name)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(count / max) * 100}%"></div></div>
      <div class="bar-value">${count}</div>
    </div>
  `).join("");
}

function renderYearChart() {
  const byYear = {};
  for (const record of filtered) {
    const year = record.day.slice(0, 4);
    byYear[year] ||= { core: 0, likely: 0, possible: 0, none: 0, total: 0 };
    byYear[year][record.ofb] += 1;
    byYear[year].total += 1;
  }
  $("yearChart").innerHTML = Object.entries(byYear).sort(([a], [b]) => a.localeCompare(b)).map(([year, row]) => {
    const total = Math.max(1, row.total);
    return `
      <div class="year-row">
        <strong>${year}</strong>
        <div class="stack" title="${year}: core ${row.core}, likely ${row.likely}, possible ${row.possible}, none ${row.none}">
          ${["core", "likely", "possible", "none"].map((key) => `<div class="segment ${key}" style="width:${(row[key] / total) * 100}%"></div>`).join("")}
        </div>
        <span class="bar-value">${row.total}</span>
      </div>
    `;
  }).join("");
}

function renderTable() {
  $("dayTable").innerHTML = filtered.map((record) => `
    <tr data-day="${record.day}" class="${record.day === selectedDay ? "selected" : ""}">
      <td><strong>${record.day}</strong></td>
      <td><span class="risk ${record.risk}">${record.risk}</span></td>
      <td>${formatClass(record.primary)}</td>
      <td><span class="regime ${record.ofb}">${record.ofb}</span></td>
      <td class="multi-line">${listText(record.hazards, 4)}</td>
      <td class="multi-line">${listText(record.modes, 4)}</td>
    </tr>
  `).join("");
  for (const row of document.querySelectorAll("#dayTable tr")) {
    row.addEventListener("click", () => showDetail(row.dataset.day));
  }
}

function detailList(title, items) {
  if (!items || items.length === 0) return "";
  return `
    <div class="detail-section">
      <h3>${title}</h3>
      <div class="chip-list">${items.map((item) => `<span class="chip">${formatClass(item)}</span>`).join("")}</div>
    </div>
  `;
}

function showDetail(day) {
  const record = records.find((item) => item.day === day);
  if (!record) return;
  selectedDay = day;
  $("detailContent").innerHTML = `
    <h2>${record.day}</h2>
    <div class="detail-meta">
      <span class="risk ${record.risk}">${record.risk}</span>
      <span class="regime ${record.ofb}">${record.ofb} OFB/MCS</span>
      <span class="chip">${record.confidence} confidence</span>
    </div>
    <div class="detail-section">
      <h3>Primary class</h3>
      <p><strong>${formatClass(record.primary)}</strong></p>
    </div>
    <div class="detail-section">
      <h3>Narrative</h3>
      <p>${record.narrative}</p>
    </div>
    <div class="detail-section">
      <h3>OFB/MCS boundary read</h3>
      <p>${record.ofb_reason}</p>
    </div>
    ${detailList("Secondary classes", record.secondary)}
    ${detailList("Boundary drivers", record.boundaries)}
    ${detailList("Storm modes", record.modes)}
    ${detailList("Dominant hazards", record.hazards)}
    ${detailList("Forecast challenges", record.challenges)}
    ${detailList("Tags", record.tags)}
    <div class="detail-section">
      <h3>Evidence</h3>
      <div class="evidence">
        ${(record.evidence || []).map((item) => `
          <div class="evidence-item">
            <a href="${item.url}" target="_blank" rel="noreferrer">${item.source}</a>
            <p>${item.quote}</p>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  $("detailPanel").classList.add("open");
  renderTable();
}

function render() {
  renderMetrics();
  renderClassChart();
  renderYearChart();
  renderTable();
}

function resetFilters() {
  activePreset = "";
  for (const id of ["yearFilter", "riskFilter", "ofbFilter", "classFilter"]) $(id).value = "";
  $("searchBox").value = "";
  applyFilters();
}

function applyPreset(preset) {
  activePreset = preset;
  for (const id of ["yearFilter", "riskFilter", "ofbFilter", "classFilter"]) $(id).value = "";
  $("searchBox").value = "";
  if (preset === "mcswind") $("searchBox").value = "mcs wind";
  if (preset === "tornado") $("searchBox").value = "tornado";
  applyFilters();
}

async function init() {
  records = await fetch("data/classifications.json").then((response) => response.json());
  records.sort((a, b) => a.day.localeCompare(b.day));
  const years = [...new Set(records.map((r) => r.day.slice(0, 4)))].sort();
  const risks = [...new Set(records.map((r) => r.risk))].sort((a, b) => riskOrder[a] - riskOrder[b]);
  const regimes = [...new Set(records.map((r) => r.ofb))].sort((a, b) => regimeOrder[a] - regimeOrder[b]);
  const classes = [...new Set(records.map((r) => r.primary))].sort((a, b) => formatClass(a).localeCompare(formatClass(b)));
  optionize($("yearFilter"), years);
  optionize($("riskFilter"), risks);
  optionize($("ofbFilter"), regimes, (value) => `${value} OFB/MCS`);
  optionize($("classFilter"), classes, formatClass);
  for (const id of ["yearFilter", "riskFilter", "ofbFilter", "classFilter"]) $(id).addEventListener("change", () => { activePreset = ""; applyFilters(); });
  $("searchBox").addEventListener("input", () => { activePreset = ""; applyFilters(); });
  $("resetFilters").addEventListener("click", resetFilters);
  $("closeDetail").addEventListener("click", () => $("detailPanel").classList.remove("open"));
  document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => applyPreset(button.dataset.preset)));
  filtered = [...records].sort((a, b) => b.day.localeCompare(a.day));
  render();
}

init();
