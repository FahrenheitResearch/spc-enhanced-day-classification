const riskOrder = { ENH_EQ: 0, ENH: 1, MDT: 2, HIGH: 3 };
const regimeOrder = { core: 1, likely: 2, possible: 3, none: 4 };
let records = [];
let filtered = [];
let selectedDay = null;
let activePreset = "";
let tornadoSummary = { days: {}, metadata: {}, day_count: 0, event_count: 0 };
const tornadoDayCache = {};

const $ = (id) => document.getElementById(id);
const formatClass = (value) => value.replaceAll("_", " ");
const formatRisk = (value) => value === "ENH_EQ" ? "ENH equiv" : value;
const listText = (items, limit = 3) => (items || []).slice(0, limit).map(formatClass).join(", ");
const formatUtc = (value = "") => value ? value.replace("T", " ").replace(":00Z", "Z") : "";
const safeText = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
}[char]));

const meowdarBase = "https://fahrenheitresearch.github.io/meowdar-95/";

function meowdarArchiveUrl(event, radar) {
  const targetTime = radar?.vwp_target_utc || event.vwp_target_utc || event.time_utc;
  if (!radar?.id || !targetTime) return "";
  const params = new URLSearchParams({
    site: radar.id,
    mode: "archive",
    time: targetTime,
    frames: "3",
    center: "1",
    autoload: "1",
    polar: "1",
    product: "REF",
    src: "spc-classification",
  });
  if (event.convective_day) params.set("day", event.convective_day);
  if (event.id) params.set("event", event.id);
  const labelParts = [event.rating, event.state, formatUtc(targetTime)].filter(Boolean);
  if (labelParts.length) params.set("label", labelParts.join(" "));
  return `${meowdarBase}?${params}`;
}

function eventImpactScore(event) {
  return (Number(event.rating_value) || 0) * 100000
    + (Number(event.fatalities) || 0) * 2000
    + (Number(event.injuries) || 0) * 40
    + (Number(event.path_length_mi) || 0);
}

function primaryMeowdarEvent(events) {
  return [...(events || [])]
    .filter((event) => event?.nearest_radars?.length)
    .sort((left, right) => eventImpactScore(right) - eventImpactScore(left))[0] || null;
}

function renderMeowdarDayLaunch(events) {
  const event = primaryMeowdarEvent(events);
  const radar = event?.nearest_radars?.[0];
  const url = event && radar ? meowdarArchiveUrl(event, radar) : "";
  if (!url) return "";
  const place = [event.location, event.county, event.state].filter(Boolean).join(", ");
  return `
    <div class="meowdar-launch">
      <div>
        <strong>Open peak target in Meowdar</strong>
        <span>${safeText(event.rating || "UNK")} ${safeText(place || `${event.begin_lat}, ${event.begin_lon}`)} &middot; ${safeText(radar.id)} &middot; ${formatUtc(radar.vwp_target_utc || event.vwp_target_utc || event.time_utc)}</span>
      </div>
      <a href="${safeText(url)}" target="_blank" rel="noreferrer">3-frame archive loop</a>
    </div>
  `;
}

const mesoBase = "https://www.spc.noaa.gov/exper/ma_archive/images_s4";
const mesoLoopBase = "https://www.spc.noaa.gov/exper/ma_archive/action5.php";
const mesoTimes = [
  { label: "12Z", hour: "12", offset: 0 },
  { label: "15Z", hour: "15", offset: 0 },
  { label: "18Z", hour: "18", offset: 0 },
  { label: "21Z", hour: "21", offset: 0 },
  { label: "00Z+1", hour: "00", offset: 1 },
  { label: "03Z+1", hour: "03", offset: 1 },
  { label: "06Z+1", hour: "06", offset: 1 },
  { label: "09Z+1", hour: "09", offset: 1 },
];
const mesoProducts = {
  pmsl: "MSL pressure / sfc wind",
  ttd: "Temp / dewpoint / wind",
  mcon: "Moisture convergence",
  sfnt: "Surface frontogenesis",
  "3cvr": "3km CAPE / sfc vorticity",
  rgnlrad: "Radar mosaic",
  "500mb": "500 mb height / temp / wind",
  "850mb": "850 mb analysis",
  "300mb": "300 mb analysis",
  mlcp: "100mb MLCAPE",
  mucp: "MUCAPE / LPL height",
  eshr: "Effective bulk shear",
  shr6: "0-6km shear",
  srh1: "0-1km SRH",
  srh3: "0-3km SRH",
  effh: "Effective SRH",
  lclh: "LCL height",
  lcls: "LCL / 0-1km SRH",
  stpc: "Effective STP",
  scp: "Supercell composite",
  dcp: "Derecho composite",
  mcsm: "MCS maintenance",
  dcape: "Downdraft CAPE",
  sigh: "Significant hail",
  hail: "Hail parameters",
  laps: "Mid-level lapse rates",
  pwtr: "Precipitable water",
  tran: "850mb moisture transport",
  prop: "Upwind propagation vector",
};
const mesoPackCatalog = {
  overview: { title: "Overview", products: ["pmsl", "500mb", "850mb", "rgnlrad"] },
  boundary: { title: "Boundary / OFB", products: ["pmsl", "ttd", "mcon", "sfnt", "3cvr", "rgnlrad"] },
  instability: { title: "Instability / Shear", products: ["mlcp", "mucp", "eshr", "shr6", "laps", "500mb"] },
  tornado: { title: "Tornado / Supercell", products: ["stpc", "scp", "srh1", "srh3", "effh", "lclh", "lcls"] },
  wind: { title: "MCS / Wind", products: ["dcp", "mcsm", "dcape", "shr6", "pmsl", "rgnlrad"] },
  hail: { title: "Hail", products: ["sigh", "hail", "laps", "mlcp", "eshr", "500mb"] },
  heavyRain: { title: "Heavy Rain", products: ["pwtr", "tran", "prop", "mcon", "850mb", "rgnlrad"] },
};

function countBy(items, getter) {
  return items.reduce((acc, item) => {
    const key = getter(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function tornadoSummaryFor(day) {
  return (tornadoSummary.days || {})[day] || null;
}

function tornadoStateCountsFor(day) {
  return tornadoSummaryFor(day)?.state_counts || {};
}

function tornadoLabel(day) {
  const summary = tornadoSummaryFor(day);
  if (!summary) return "0";
  return `${summary.tornado_count} <span>${safeText(summary.strongest_rating || "UNK")}</span>`;
}

function addDays(day, offset) {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, date + offset));
  return `${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, "0")}${String(value.getUTCDate()).padStart(2, "0")}`;
}

function mesoUrl(day, product, time) {
  const ymd = addDays(day, time.offset);
  return `${mesoBase}/${ymd}/${time.hour}_${product}.gif`;
}

function mesoLoopUrl(day, product, time) {
  const ymd = addDays(day, time.offset);
  return `${mesoLoopBase}?BASICPARAM=${product}.gif&STARTYEAR=${ymd.slice(0, 4)}&STARTMONTH=${ymd.slice(4, 6)}&STARTDAY=${ymd.slice(6, 8)}&STARTTIME=${time.hour}&INC=-6`;
}

function dayText(record) {
  return [
    record.primary,
    record.ofb,
    record.ofb_reason,
    record.narrative,
    ...(record.secondary || []),
    ...(record.tags || []),
    ...(record.boundaries || []),
    ...(record.modes || []),
    ...(record.hazards || []),
    ...(record.challenges || []),
  ].join(" ").toLowerCase();
}

function defaultMesoTime(record) {
  const text = dayText(record);
  if (text.includes("nocturnal") || text.includes("elevated") || text.includes("overnight")) return mesoTimes[5];
  if (text.includes("mcs") || text.includes("derecho") || text.includes("qlcs")) return mesoTimes[4];
  return mesoTimes[3];
}

function mesoPacksFor(record) {
  const text = dayText(record);
  const packIds = ["overview", "instability"];
  if (["core", "likely"].includes(record.ofb) || /outflow|cold pool|effective boundary|mcv|frontogenesis|differential heating/.test(text)) packIds.push("boundary");
  if (/tornado|supercell|srh|stp|cyclic/.test(text)) packIds.push("tornado");
  if (/mcs|derecho|qlcs|bow|wind damage|damaging wind|cold pool/.test(text)) packIds.push("wind");
  if (/hail|lapse rate/.test(text)) packIds.push("hail");
  if (/flash flood|training|heavy rain|precipitable|moisture transport/.test(text)) packIds.push("heavyRain");
  return [...new Set(packIds)].map((id) => mesoPackCatalog[id]);
}

function renderMesoanalysis(record) {
  const defaultTime = defaultMesoTime(record);
  const packs = mesoPacksFor(record);
  const seenProducts = new Set();
  const displayPacks = packs.map((pack) => ({
    ...pack,
    products: pack.products.filter((product) => {
      if (seenProducts.has(product)) return false;
      seenProducts.add(product);
      return true;
    }),
  })).filter((pack) => pack.products.length);
  const allProducts = [...seenProducts];
  const loopUrl = mesoLoopUrl(record.day, "pmsl", defaultTime);
  return `
    <div class="detail-section">
      <div class="meso-toolbar">
        <h3>SPC Mesoanalysis Maps</h3>
        <a href="${loopUrl}" target="_blank" rel="noreferrer">SPC archive loop</a>
      </div>
      <div class="chip-list">${allProducts.map((product) => `<span class="chip">${safeText(mesoProducts[product] || product)}</span>`).join("")}</div>
      ${displayPacks.map((pack) => `
        <div class="meso-pack">
          <h4>${pack.title}</h4>
          <div class="meso-grid">
            ${pack.products.map((product) => {
              const previewUrl = mesoUrl(record.day, product, defaultTime);
              return `
                <div class="meso-card">
                  <a class="meso-preview" href="${previewUrl}" target="_blank" rel="noreferrer">
                    <img src="${previewUrl}" loading="lazy" alt="${safeText(mesoProducts[product] || product)} ${record.day} ${defaultTime.label}" onerror="this.closest('.meso-card').classList.add('missing'); this.remove();">
                  </a>
                  <div class="meso-card-body">
                    <div class="meso-title-row">
                      <a href="${mesoLoopUrl(record.day, product, defaultTime)}" target="_blank" rel="noreferrer">${safeText(mesoProducts[product] || product)}</a>
                      <span class="meso-default-time">${defaultTime.label}</span>
                    </div>
                    <div class="meso-times">
                      ${mesoTimes.map((time) => `<a href="${mesoUrl(record.day, product, time)}" target="_blank" rel="noreferrer">${time.label}</a>`).join("")}
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderTornadoTargetSummary(day) {
  const summary = tornadoSummaryFor(day);
  if (!summary) {
    return `
      <div class="detail-section">
        <h3>Tornado / Radar Targets</h3>
        <p class="tornado-note">No observed tornado target rows matched this 12Z-to-12Z classified day.</p>
      </div>
    `;
  }
  const sources = Object.entries(summary.source_counts || {}).map(([name, count]) => `${count} ${name}`).join("; ");
  return `
    <div class="detail-section">
      <h3>Tornado / Radar Targets</h3>
      <div class="tornado-summary-grid">
        <div class="tornado-stat"><strong>${summary.tornado_count}</strong><span>tornadoes</span></div>
        <div class="tornado-stat"><strong>${safeText(summary.strongest_rating || "UNK")}</strong><span>strongest</span></div>
        <div class="tornado-stat"><strong>${summary.total_fatalities || 0}</strong><span>fatalities</span></div>
        <div class="tornado-stat"><strong>${summary.total_injuries || 0}</strong><span>injuries</span></div>
      </div>
      <p class="tornado-note"><strong>Window:</strong> ${formatUtc(summary.earliest_time_utc)} to ${formatUtc(summary.latest_time_utc)}. <strong>Sources:</strong> ${safeText(sources || "event-level source rows")}.</p>
      <p class="tornado-note">Loading event-level nearest-radar targets...</p>
    </div>
  `;
}

async function loadTornadoTargets(day) {
  if (!tornadoSummaryFor(day)) return null;
  if (tornadoDayCache[day]) return tornadoDayCache[day];
  try {
    const response = await fetch(`data/tornado_targets/${day}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    tornadoDayCache[day] = await response.json();
    return tornadoDayCache[day];
  } catch (error) {
    return { error: String(error), events: [] };
  }
}

function renderRadarTargets(event) {
  return (event.nearest_radars || []).map((radar, index) => {
    const url = meowdarArchiveUrl(event, radar);
    const chipText = `${index + 1}. ${safeText(radar.id)} <span>${safeText(radar.distance_mi)} mi</span>`;
    return url
      ? `<a class="radar-chip meowdar-radar-link" href="${safeText(url)}" target="_blank" rel="noreferrer" title="Open a centered 3-frame archive loop in Meowdar">${chipText}<em>Meowdar</em></a>`
      : `<span class="radar-chip">${chipText}</span>`;
  }).join("");
}

function renderTornadoEvent(event) {
  const place = [event.location, event.county, event.state].filter(Boolean).join(", ");
  const path = event.path_length_mi ? `${event.path_length_mi} mi path` : "path length n/a";
  const width = event.width_yd ? `${event.width_yd} yd wide` : "width n/a";
  const sourceUrl = event.source_url || "data/tornado_radar_targets.csv";
  return `
    <div class="tornado-event">
      <div class="tornado-event-head">
        <strong>${formatUtc(event.time_utc)}</strong>
        <span class="chip">${safeText(event.rating || "UNK")}</span>
      </div>
      <div class="tornado-event-meta">
        <span>${safeText(place || `${event.begin_lat}, ${event.begin_lon}`)}</span>
        <span>${safeText(path)}</span>
        <span>${safeText(width)}</span>
        <span>${event.fatalities || 0} fatal / ${event.injuries || 0} inj</span>
      </div>
      <div class="tornado-event-meta">
        <span>VWP ${formatUtc(event.vwp_start_utc)} - ${formatUtc(event.vwp_end_utc)}</span>
        <a href="${sourceUrl}" target="_blank" rel="noreferrer">source</a>
      </div>
      <div class="radar-targets">${renderRadarTargets(event)}</div>
    </div>
  `;
}

function renderTornadoTargets(day, payload) {
  const summary = tornadoSummaryFor(day);
  if (!summary) return renderTornadoTargetSummary(day);
  if (!payload) return renderTornadoTargetSummary(day);
  if (payload.error) {
    return `
      <div class="detail-section">
        <h3>Tornado / Radar Targets</h3>
        <p class="tornado-note">Could not load event-level radar targets: ${safeText(payload.error)}</p>
      </div>
    `;
  }
  const events = payload.events || [];
  return `
    <div class="detail-section">
      <h3>Tornado / Radar Targets</h3>
      <div class="tornado-summary-grid">
        <div class="tornado-stat"><strong>${summary.tornado_count}</strong><span>tornadoes</span></div>
        <div class="tornado-stat"><strong>${safeText(summary.strongest_rating || "UNK")}</strong><span>strongest</span></div>
        <div class="tornado-stat"><strong>${summary.total_fatalities || 0}</strong><span>fatalities</span></div>
        <div class="tornado-stat"><strong>${summary.total_injuries || 0}</strong><span>injuries</span></div>
      </div>
      <p class="tornado-note">Nearest three current NEXRAD sites are calculated from each tornado begin point. VWP windows are centered on observed begin time with a +/-30 minute window.</p>
      ${renderMeowdarDayLaunch(events)}
      <div class="tornado-event-list">${events.map(renderTornadoEvent).join("")}</div>
    </div>
  `;
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
  const torn = tornadoSummaryFor(record.day);
  const haystack = [
    record.day,
    record.risk,
    record.primary,
    record.ofb,
    torn ? `${torn.tornado_count} tornadoes ${torn.strongest_rating}` : "",
    ...Object.entries(torn?.state_counts || {}).map(([state, count]) => `${state} tornado ${count}`),
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
  const tornadoState = $("tornadoStateFilter").value;
  const query = $("searchBox").value.trim();
  filtered = records.filter((record) => {
    const presetOk = activePreset === "corelikely"
      ? ["core", "likely"].includes(record.ofb)
      : activePreset === "observedtornado"
        ? Boolean(tornadoSummaryFor(record.day))
        : true;
    return (!year || record.day.startsWith(year)) &&
      (!risk || record.risk === risk) &&
      (!ofb || record.ofb === ofb) &&
      (!primary || record.primary === primary) &&
      (!tornadoState || Number(tornadoStateCountsFor(record.day)[tornadoState] || 0) > 0) &&
      presetOk &&
      matchesSearch(record, query);
  }).sort((a, b) => b.day.localeCompare(a.day));
  render();
}

function renderMetrics() {
  const coreLikely = filtered.filter((r) => r.ofb === "core" || r.ofb === "likely").length;
  const tornadoDays = filtered.filter((r) => tornadoSummaryFor(r.day)).length;
  const high = filtered.filter((r) => r.risk === "HIGH").length;
  $("metricDays").textContent = filtered.length.toLocaleString();
  $("metricCoreLikely").textContent = coreLikely.toLocaleString();
  $("metricTornadoDays").textContent = tornadoDays.toLocaleString();
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
      <td><span class="risk ${record.risk}">${formatRisk(record.risk)}</span></td>
      <td>${formatClass(record.primary)}</td>
      <td><span class="regime ${record.ofb}">${record.ofb}</span></td>
      <td class="tornado-count">${tornadoLabel(record.day)}</td>
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

async function loadTornadoSummary() {
  try {
    const response = await fetch("data/tornado_radar_summary.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch {
    return { days: {}, metadata: {}, day_count: 0, event_count: 0 };
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
      <span class="risk ${record.risk}">${formatRisk(record.risk)}</span>
      <span class="regime ${record.ofb}">${record.ofb} OFB/MCS</span>
      <span class="chip">${record.confidence} confidence</span>
    </div>
    <div class="detail-actions">
      <button id="copyDayLink" type="button">Copy day link</button>
      <a href="data/packets/${record.day}.json" target="_blank" rel="noreferrer">Source packet JSON</a>
      ${tornadoSummaryFor(record.day) ? `<a href="data/tornado_targets/${record.day}.json" target="_blank" rel="noreferrer">Tornado target JSON</a>` : ""}
      <a href="data/tornado_radar_targets.csv" target="_blank" rel="noreferrer">Tornado target CSV</a>
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
    <div id="tornadoTargets">${renderTornadoTargetSummary(record.day)}</div>
    ${renderMesoanalysis(record)}
    <div id="sourcePacket">${renderSourcePacket(null)}</div>
  `;
  $("detailPanel").classList.add("open");
  const copyButton = document.querySelector("#copyDayLink");
  if (copyButton) copyButton.addEventListener("click", () => copyDayLink(record.day));
  renderTable();
  const [targets, packet] = await Promise.all([loadTornadoTargets(record.day), loadPacket(record.day)]);
  if (selectedDay !== record.day) return;
  const targetContainer = document.querySelector("#tornadoTargets");
  if (targetContainer) targetContainer.innerHTML = renderTornadoTargets(record.day, targets);
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
  for (const id of ["yearFilter", "riskFilter", "ofbFilter", "classFilter", "tornadoStateFilter"]) $(id).value = "";
  $("searchBox").value = "";
  applyFilters();
}

function applyPreset(preset) {
  activePreset = preset;
  for (const id of ["yearFilter", "riskFilter", "ofbFilter", "classFilter", "tornadoStateFilter"]) $(id).value = "";
  $("searchBox").value = "";
  if (preset === "mcswind") $("searchBox").value = "mcs wind";
  if (preset === "tornado") $("searchBox").value = "tornado";
  applyFilters();
}

function syncDetailFromHash() {
  const hashMatch = location.hash.match(/day=(\d{4}-\d{2}-\d{2})/);
  if (hashMatch) showDetail(hashMatch[1], false);
}

async function init() {
  [records, tornadoSummary] = await Promise.all([
    fetch("data/classifications.json").then((response) => response.json()),
    loadTornadoSummary(),
  ]);
  records.sort((a, b) => a.day.localeCompare(b.day));
  const years = [...new Set(records.map((r) => r.day.slice(0, 4)))].sort();
  const risks = [...new Set(records.map((r) => r.risk))].sort((a, b) => riskOrder[a] - riskOrder[b]);
  const regimes = [...new Set(records.map((r) => r.ofb))].sort((a, b) => regimeOrder[a] - regimeOrder[b]);
  const classes = [...new Set(records.map((r) => r.primary))].sort((a, b) => formatClass(a).localeCompare(formatClass(b)));
  const tornadoStates = Object.entries(Object.values(tornadoSummary.days || {}).reduce((counts, day) => {
    for (const state of Object.keys(day.state_counts || {})) counts[state] = (counts[state] || 0) + 1;
    return counts;
  }, {})).sort(([a], [b]) => a.localeCompare(b));
  optionize($("yearFilter"), years);
  optionize($("riskFilter"), risks, formatRisk);
  optionize($("ofbFilter"), regimes, (value) => `${value} OFB/MCS`);
  optionize($("classFilter"), classes, formatClass);
  optionize($("tornadoStateFilter"), tornadoStates.map(([state]) => state), (state) => `${state} (${tornadoStates.find(([value]) => value === state)?.[1] || 0} days)`);
  for (const id of ["yearFilter", "riskFilter", "ofbFilter", "classFilter", "tornadoStateFilter"]) $(id).addEventListener("change", () => { activePreset = ""; applyFilters(); });
  $("searchBox").addEventListener("input", () => { activePreset = ""; applyFilters(); });
  $("resetFilters").addEventListener("click", resetFilters);
  $("closeDetail").addEventListener("click", () => $("detailPanel").classList.remove("open"));
  document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => applyPreset(button.dataset.preset)));
  filtered = [...records].sort((a, b) => b.day.localeCompare(a.day));
  render();
  syncDetailFromHash();
  window.addEventListener("hashchange", syncDetailFromHash);
}

init();
