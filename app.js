const riskOrder = { ENH: 1, MDT: 2, HIGH: 3 };
const regimeOrder = { core: 1, likely: 2, possible: 3, none: 4 };
let records = [];
let filtered = [];
let selectedDay = null;
let activePreset = "";

const $ = (id) => document.getElementById(id);
const formatClass = (value) => value.replaceAll("_", " ");
const listText = (items, limit = 3) => (items || []).slice(0, limit).map(formatClass).join(", ");
const safeText = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
}[char]));

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
      <td><button class="audit-btn" type="button" data-day="${record.day}">Inspect</button></td>
    </tr>
  `).join("");
  for (const row of document.querySelectorAll("#dayTable tr")) {
    row.addEventListener("click", () => showDetail(row.dataset.day));
  }
  for (const button of document.querySelectorAll(".audit-btn")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      showDetail(button.dataset.day);
    });
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

function renderSourcePacket(packet) {
  if (!packet) {
    return `
      <div class="detail-section">
        <h3>Source Packet</h3>
        <p>Loading source packet...</p>
      </div>
    `;
  }
  const outlooks = packet.outlooks || [];
  const mds = packet.mesoscale_discussions || [];
  return `
    <div class="detail-section">
      <h3>Day 1 Outlooks (${outlooks.length})</h3>
      <div class="source-list">
        ${outlooks.map((item) => `
          <div class="source-item">
            <a href="${item.url}" target="_blank" rel="noreferrer">D1 ${item.hhmm}Z ${item.issued_product_date} (${item.max_risk_in_product})</a>
            <p>${safeText(item.summary || "No summary extracted.")}</p>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="detail-section">
      <h3>Mesoscale Discussions (${mds.length})</h3>
      <div class="source-list">
        ${mds.length ? mds.map((item) => `
          <div class="source-item">
            <a href="${item.url}" target="_blank" rel="noreferrer">MD ${item.year}-${String(item.number).padStart(4, "0")} ${item.issue_utc}</a>
            <p><strong>${safeText(item.topic || "SPC MD")}</strong></p>
            <p>${safeText(item.summary || item.discussion || "No summary extracted.").slice(0, 600)}</p>
          </div>
        `).join("") : "<p>No convective MDs were attached to this 12Z-to-12Z day.</p>"}
      </div>
    </div>
  `;
}

async function loadPacket(day) {
  try {
    const response = await fetch(`data/packets/${day}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    return { error: String(error), outlooks: [], mesoscale_discussions: [] };
  }
}

async function copyDayLink(day) {
  const url = `${location.origin}${location.pathname}#day=${day}`;
  try {
    await navigator.clipboard.writeText(url);
    const button = document.querySelector("#copyDayLink");
    if (button) {
      button.textContent = "Copied";
      setTimeout(() => button.textContent = "Copy day link", 1200);
    }
  } catch {
    location.hash = `day=${day}`;
  }
}

async function showDetail(day, updateHash = true) {
  const record = records.find((item) => item.day === day);
  if (!record) return;
  selectedDay = day;
  if (updateHash) history.replaceState(null, "", `#day=${day}`);
  $("detailContent").innerHTML = `
    <h2>${record.day}</h2>
    <div class="detail-meta">
      <span class="risk ${record.risk}">${record.risk}</span>
      <span class="regime ${record.ofb}">${record.ofb} OFB/MCS</span>
      <span class="chip">${record.confidence} confidence</span>
    </div>
    <div class="detail-actions">
      <button id="copyDayLink" type="button">Copy day link</button>
      <a href="data/packets/${record.day}.json" target="_blank" rel="noreferrer">Source packet JSON</a>
      <a href="data/all_classifications.jsonl" target="_blank" rel="noreferrer">Full JSONL</a>
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
    <div id="sourcePacket">${renderSourcePacket(null)}</div>
  `;
  $("detailPanel").classList.add("open");
  const copyButton = document.querySelector("#copyDayLink");
  if (copyButton) copyButton.addEventListener("click", () => copyDayLink(record.day));
  renderTable();
  const packet = await loadPacket(record.day);
  const packetContainer = document.querySelector("#sourcePacket");
  if (packetContainer) packetContainer.innerHTML = packet.error ? `
    <div class="detail-section">
      <h3>Source Packet</h3>
      <p>Could not load source packet: ${safeText(packet.error)}</p>
    </div>
  ` : renderSourcePacket(packet);
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
  const hashMatch = location.hash.match(/day=(\d{4}-\d{2}-\d{2})/);
  if (hashMatch) showDetail(hashMatch[1], false);
}

init();
