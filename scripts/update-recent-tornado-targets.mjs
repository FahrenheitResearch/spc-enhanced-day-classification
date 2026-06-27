import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const TARGET_YEAR = "2026";
const VWP_WINDOW_MINUTES = 30;
const NCEI_DETAILS_URL = "https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2026_c20260625.csv.gz";
const SPC_REPORT_BASE = "https://www.spc.noaa.gov/climo/reports";
const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const TARGET_DIR = path.join(DATA_DIR, "tornado_targets");

const OFFICIAL_SURVEY_SUPPLEMENTS = [
  {
    day: "2026-04-23",
    state: "OK",
    county: "Grant",
    locationPattern: /renfrow/i,
    timeUtc: "2026-04-23T23:42:00Z",
    location: "5 N Deer Creek",
    rating: "EFU",
    path_length_mi: 1,
    width_yd: 50,
    fatalities: 0,
    injuries: 0,
    comments: "NWS Norman 2026 Oklahoma tornado table: Grant County tornado, 5 N Deer Creek, EFU.",
    source_url: "https://www.weather.gov/oun/tornadodata-ok-2026",
  },
  {
    day: "2026-04-23",
    state: "OK",
    county: "Kay",
    locationPattern: /braman/i,
    timeUtc: "2026-04-24T00:00:00Z",
    location: "4 SW Blackwell Lake - 1 SSW Braman",
    rating: "EF1",
    path_length_mi: 10,
    width_yd: 400,
    fatalities: 0,
    injuries: 0,
    comments: "NWS Norman 2026 Oklahoma tornado table: Kay County tornado from 4 SW Blackwell Lake to 1 SSW Braman, EF1.",
    source_url: "https://www.weather.gov/oun/tornadodata-ok-2026",
  },
  {
    day: "2026-04-23",
    state: "OK",
    county: "Garfield",
    locationPattern: /vance|enid/i,
    timeUtc: "2026-04-24T01:11:00Z",
    location: "3 SW Vance AFB - 5 ESE Enid",
    rating: "EF4",
    path_length_mi: 10,
    width_yd: 600,
    fatalities: 0,
    injuries: 1,
    comments: "NWS Norman 2026 Oklahoma tornado table: Garfield County tornado from 3 SW Vance AFB to 5 ESE Enid, EF4.",
    source_url: "https://www.weather.gov/oun/tornadodata-ok-2026",
  },
  {
    day: "2026-04-23",
    state: "OK",
    county: "Kay",
    locationPattern: /newkirk/i,
    timeUtc: "2026-04-24T01:13:00Z",
    location: "1.5 SE Newkirk",
    rating: "EFU",
    path_length_mi: 0.6,
    width_yd: 50,
    fatalities: 0,
    injuries: 0,
    comments: "NWS Norman 2026 Oklahoma tornado table: Kay County tornado near 1.5 SE Newkirk, EFU.",
    source_url: "https://www.weather.gov/oun/tornadodata-ok-2026",
  },
];

const STATE_CODES = {
  ALABAMA: "AL",
  ALASKA: "AK",
  ARIZONA: "AZ",
  ARKANSAS: "AR",
  CALIFORNIA: "CA",
  COLORADO: "CO",
  CONNECTICUT: "CT",
  DELAWARE: "DE",
  "DISTRICT OF COLUMBIA": "DC",
  FLORIDA: "FL",
  GEORGIA: "GA",
  HAWAII: "HI",
  IDAHO: "ID",
  ILLINOIS: "IL",
  INDIANA: "IN",
  IOWA: "IA",
  KANSAS: "KS",
  KENTUCKY: "KY",
  LOUISIANA: "LA",
  MAINE: "ME",
  MARYLAND: "MD",
  MASSACHUSETTS: "MA",
  MICHIGAN: "MI",
  MINNESOTA: "MN",
  MISSISSIPPI: "MS",
  MISSOURI: "MO",
  MONTANA: "MT",
  NEBRASKA: "NE",
  NEVADA: "NV",
  "NEW HAMPSHIRE": "NH",
  "NEW JERSEY": "NJ",
  "NEW MEXICO": "NM",
  "NEW YORK": "NY",
  "NORTH CAROLINA": "NC",
  "NORTH DAKOTA": "ND",
  OHIO: "OH",
  OKLAHOMA: "OK",
  OREGON: "OR",
  PENNSYLVANIA: "PA",
  "PUERTO RICO": "PR",
  "RHODE ISLAND": "RI",
  "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD",
  TENNESSEE: "TN",
  TEXAS: "TX",
  UTAH: "UT",
  VERMONT: "VT",
  VIRGINIA: "VA",
  WASHINGTON: "WA",
  "WEST VIRGINIA": "WV",
  WISCONSIN: "WI",
  WYOMING: "WY",
};

const CSV_COLUMNS = [
  "convective_day",
  "time_utc",
  "rating",
  "state",
  "county",
  "location",
  "begin_lat",
  "begin_lon",
  "path_length_mi",
  "width_yd",
  "fatalities",
  "injuries",
  "vwp_start_utc",
  "vwp_target_utc",
  "vwp_end_utc",
  "radar1",
  "radar1_name",
  "radar1_distance_mi",
  "radar2",
  "radar2_name",
  "radar2_distance_mi",
  "radar3",
  "radar3_name",
  "radar3_distance_mi",
  "event_id",
  "source",
  "source_url",
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === "\"") {
        if (text[i + 1] === "\"") {
          field += "\"";
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((item) => item.some((cell) => String(cell).trim()));
}

function csvValue(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function csvLine(values) {
  return values.map(csvValue).join(",");
}

function parseNceiLocalTime(value, zone) {
  const match = String(value || "").match(/^(\d{1,2})-([A-Z]{3})-(\d{2,4})\s+(\d{1,2}):(\d{2}):(\d{2})$/i);
  if (!match) return null;
  const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  const day = Number(match[1]);
  const month = months[match[2].toUpperCase()];
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetMatch = String(zone || "").match(/([+-]\d{1,2})(?::?(\d{2}))?$/);
  const offsetHours = offsetMatch ? Number(offsetMatch[1]) + Number(offsetMatch[2] || 0) / 60 * Math.sign(Number(offsetMatch[1]) || 1) : 0;
  return new Date(Date.UTC(year, month, day, hour, minute, second) - offsetHours * 3600_000);
}

function spcReportTimeUtc(day, hhmm) {
  const [year, month, date] = day.split("-").map(Number);
  const text = String(hhmm || "").padStart(4, "0");
  const hour = Number(text.slice(0, 2));
  const minute = Number(text.slice(2, 4));
  const base = Date.UTC(year, month - 1, date, hour, minute, 0);
  return new Date(base + (hour < 12 ? 24 * 3600_000 : 0));
}

function iso(date) {
  return date.toISOString().replace(".000Z", "Z");
}

function shiftMinutes(value, minutes) {
  return iso(new Date(new Date(value).getTime() + minutes * 60_000));
}

function convectiveDayFromUtc(date) {
  const shifted = new Date(date.getTime() - 12 * 3600_000);
  return shifted.toISOString().slice(0, 10);
}

function normalizeState(value) {
  const text = String(value || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(text)) return text;
  return STATE_CODES[text] || text;
}

function ratingValue(rating) {
  const text = String(rating || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (text === "EFU" || text === "FU") return -1;
  const match = text.match(/[EF]?([0-5])/);
  if (match) return Number(match[1]);
  return -9;
}

function normalizeRating(value, comments = "") {
  const direct = String(value || "").trim().toUpperCase().replace(/^F([0-5U])$/, "EF$1");
  if (direct && direct !== "UNK" && direct !== "-9") return { rating: direct.replace(/^EF-/, "EF"), estimated: false };
  const text = String(comments || "");
  const match = text.match(/\bEF[\s-]*([0-5U])\b/i) || text.match(/\bF[\s-]*([0-5])\b/i);
  if (!match) return { rating: "UNK", estimated: false };
  return { rating: `EF${match[1].toUpperCase()}`, estimated: true };
}

function parseNumber(value) {
  const number = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function inferPathLength(comments) {
  const match = String(comments || "").match(/path length(?:\s+of)?\s+([\d.]+)\s*(?:mi|mile)/i)
    || String(comments || "").match(/([\d.]+)\s*(?:mi|mile)[\w\s.-]{0,20}\spath/i);
  return match ? Number(match[1]) : null;
}

function inferWidth(comments) {
  const match = String(comments || "").match(/path width(?:\s+of)?\s+([\d.]+)\s*(?:yd|yard)/i)
    || String(comments || "").match(/width(?:\s+was)?\s+([\d.]+)\s*(?:yd|yard)/i);
  return match ? Number(match[1]) : null;
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = (value) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function radarRank(id) {
  if (id.startsWith("K")) return 0;
  if (id.startsWith("P")) return 1;
  if (id.startsWith("T")) return 2;
  return 3;
}

function nearestRadars(radars, lat, lon, timeUtc) {
  return radars
    .map((radar) => ({
      id: radar.id,
      name: radar.name || radar.id,
      state: radar.state,
      lat: radar.lat,
      lon: radar.lon,
      distance_mi: haversineMiles(lat, lon, Number(radar.lat), Number(radar.lon)),
      vwp_start_utc: shiftMinutes(timeUtc, -VWP_WINDOW_MINUTES),
      vwp_target_utc: timeUtc,
      vwp_end_utc: shiftMinutes(timeUtc, VWP_WINDOW_MINUTES),
    }))
    .filter((radar) => Number.isFinite(radar.distance_mi))
    .sort((a, b) => radarRank(a.id) - radarRank(b.id) || a.distance_mi - b.distance_mi)
    .slice(0, 3)
    .map((radar) => ({ ...radar, distance_mi: Number(radar.distance_mi.toFixed(1)) }));
}

function stateCounts(events) {
  const counts = {};
  for (const event of events) {
    const state = event.state_code || normalizeState(event.state);
    if (!state) continue;
    counts[state] = (counts[state] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort());
}

function summarizeDay(day, events, metadata) {
  const sorted = [...events].sort((a, b) => String(a.time_utc).localeCompare(String(b.time_utc)));
  const values = sorted.map((event) => ratingValue(event.rating));
  const maxValue = Math.max(...values);
  const strongest = sorted.find((event) => ratingValue(event.rating) === maxValue)?.rating || "UNK";
  const sourceCounts = {};
  for (const event of sorted) sourceCounts[event.source] = (sourceCounts[event.source] || 0) + 1;
  return {
    metadata,
    convective_day: day,
    tornado_count: sorted.length,
    earliest_time_utc: sorted[0]?.time_utc || null,
    latest_time_utc: sorted.at(-1)?.time_utc || null,
    strongest_rating: strongest,
    total_injuries: sorted.reduce((sum, event) => sum + (Number(event.injuries) || 0), 0),
    total_fatalities: sorted.reduce((sum, event) => sum + (Number(event.fatalities) || 0), 0),
    source_counts: Object.fromEntries(Object.entries(sourceCounts).sort()),
    state_counts: stateCounts(sorted),
    events: sorted,
  };
}

function minutesBetweenIso(a, b) {
  const aTime = new Date(a).getTime();
  const bTime = new Date(b).getTime();
  if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return Infinity;
  return Math.abs(aTime - bTime) / 60_000;
}

function applyOfficialSurveySupplements(day, events) {
  const supplements = OFFICIAL_SURVEY_SUPPLEMENTS.filter((item) => item.day === day);
  if (!supplements.length) return events;
  const used = new Set();
  return events.map((event) => {
    const supplement = supplements.find((item, index) => {
      if (used.has(index)) return false;
      if ((event.state_code || normalizeState(event.state)) !== item.state) return false;
      if (!String(event.county || "").toLowerCase().includes(item.county.toLowerCase())) return false;
      if (!item.locationPattern.test(String(event.location || ""))) return false;
      return minutesBetweenIso(event.time_utc, item.timeUtc) <= 15;
    });
    if (!supplement) return event;
    used.add(supplements.indexOf(supplement));
    return {
      ...event,
      source: "SPC preliminary storm reports + NWS Norman survey supplement",
      source_url: supplement.source_url,
      survey_source: "NWS Norman 2026 Oklahoma tornado table",
      survey_source_url: supplement.source_url,
      rating: supplement.rating,
      rating_value: ratingValue(supplement.rating),
      rating_estimated: false,
      location: supplement.location,
      path_length_mi: supplement.path_length_mi,
      width_yd: supplement.width_yd,
      fatalities: supplement.fatalities,
      injuries: supplement.injuries,
      comments: [supplement.comments, event.comments].filter(Boolean).join(" Original SPC report: "),
    };
  });
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "meowdar-data-refresh" } });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.text();
}

async function fetchNceiRows() {
  const response = await fetch(NCEI_DETAILS_URL, { headers: { "user-agent": "meowdar-data-refresh" } });
  if (!response.ok) throw new Error(`${NCEI_DETAILS_URL} HTTP ${response.status}`);
  const zipped = Buffer.from(await response.arrayBuffer());
  return parseCsv(zlib.gunzipSync(zipped).toString("utf8"));
}

async function fetchSpcTornadoReports(day) {
  const compact = day.slice(2).replaceAll("-", "");
  const urls = [
    `${SPC_REPORT_BASE}/${compact}_rpts_filtered.csv`,
    `${SPC_REPORT_BASE}/${compact}_rpts.csv`,
  ];
  let text = "";
  let sourceUrl = "";
  for (const url of urls) {
    try {
      text = await fetchText(url);
      sourceUrl = url;
      break;
    } catch {
      // Try the next SPC report flavor.
    }
  }
  if (!text) return [];
  const rows = parseCsv(text);
  const events = [];
  let section = "";
  for (const row of rows) {
    const first = String(row[0] || "").trim().toLowerCase();
    if (first === "time") {
      const second = String(row[1] || "").trim().toLowerCase();
      section = second.includes("f_scale") ? "tornado" : "";
      continue;
    }
    if (section !== "tornado") continue;
    const [timeHhmm, scale, location, county, state, latText, lonText, comments] = row;
    const lat = Number(latText);
    const lon = Number(lonText);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const time = spcReportTimeUtc(day, timeHhmm);
    const rating = normalizeRating(scale, comments);
    events.push({
      source: "SPC preliminary storm reports",
      source_url: sourceUrl,
      source_time_basis: "SPC 12Z convective-day report; all times UTC",
      convective_day: day,
      time_utc: iso(time),
      rating: rating.rating,
      rating_value: ratingValue(rating.rating),
      rating_estimated: rating.estimated,
      state: normalizeState(state),
      state_code: normalizeState(state),
      location: String(location || "").trim(),
      county: String(county || "").trim(),
      begin_lat: lat,
      begin_lon: lon,
      end_lat: null,
      end_lon: null,
      path_length_mi: inferPathLength(comments),
      width_yd: inferWidth(comments),
      injuries: /inj/i.test(comments || "") ? 0 : 0,
      fatalities: /fatal/i.test(comments || "") ? 0 : 0,
      comments: String(comments || "").trim(),
    });
  }
  return events.map((event, index) => ({ ...event, id: `spc-prelim-${day}-${index + 1}` }));
}

function nceiEventsByDay(rows, classifiedDays, radars) {
  const [header, ...records] = rows;
  const index = Object.fromEntries(header.map((name, i) => [name, i]));
  const byDay = new Map();
  for (const row of records) {
    if (String(row[index.EVENT_TYPE] || "").toUpperCase() !== "TORNADO") continue;
    const time = parseNceiLocalTime(row[index.BEGIN_DATE_TIME], row[index.CZ_TIMEZONE]);
    if (!time) continue;
    const day = convectiveDayFromUtc(time);
    if (!classifiedDays.has(day)) continue;
    const lat = Number(row[index.BEGIN_LAT]);
    const lon = Number(row[index.BEGIN_LON]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const timeUtc = iso(time);
    const rating = normalizeRating(row[index.TOR_F_SCALE]);
    const event = {
      id: `ncei-${row[index.EVENT_ID]}`,
      source: "NCEI Storm Events details",
      source_url: `https://www.ncei.noaa.gov/stormevents/eventdetails.jsp?id=${row[index.EVENT_ID]}`,
      source_time_basis: `${row[index.CZ_TIMEZONE]}; converted to UTC here`,
      convective_day: day,
      time_utc: timeUtc,
      rating: rating.rating,
      rating_value: ratingValue(rating.rating),
      rating_estimated: rating.estimated,
      state: row[index.STATE],
      state_code: normalizeState(row[index.STATE]),
      location: row[index.BEGIN_LOCATION],
      county: row[index.CZ_NAME],
      begin_lat: lat,
      begin_lon: lon,
      end_lat: parseNumber(row[index.END_LAT]),
      end_lon: parseNumber(row[index.END_LON]),
      path_length_mi: parseNumber(row[index.TOR_LENGTH]),
      width_yd: parseNumber(row[index.TOR_WIDTH]),
      injuries: (Number(row[index.INJURIES_DIRECT]) || 0) + (Number(row[index.INJURIES_INDIRECT]) || 0),
      fatalities: (Number(row[index.DEATHS_DIRECT]) || 0) + (Number(row[index.DEATHS_INDIRECT]) || 0),
      comments: [row[index.EVENT_NARRATIVE], row[index.EPISODE_NARRATIVE]].filter(Boolean).join(" "),
    };
    event.nearest_radars = nearestRadars(radars, event.begin_lat, event.begin_lon, event.time_utc);
    event.vwp_start_utc = shiftMinutes(event.time_utc, -VWP_WINDOW_MINUTES);
    event.vwp_target_utc = event.time_utc;
    event.vwp_end_utc = shiftMinutes(event.time_utc, VWP_WINDOW_MINUTES);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(event);
  }
  return byDay;
}

function eventCsvRow(event) {
  const radars = event.nearest_radars || [];
  const value = {
    convective_day: event.convective_day,
    time_utc: event.time_utc,
    rating: event.rating,
    state: event.state_code || normalizeState(event.state),
    county: event.county,
    location: event.location,
    begin_lat: event.begin_lat,
    begin_lon: event.begin_lon,
    path_length_mi: event.path_length_mi ?? "",
    width_yd: event.width_yd ?? "",
    fatalities: event.fatalities ?? 0,
    injuries: event.injuries ?? 0,
    vwp_start_utc: event.vwp_start_utc,
    vwp_target_utc: event.vwp_target_utc,
    vwp_end_utc: event.vwp_end_utc,
    radar1: radars[0]?.id || "",
    radar1_name: radars[0]?.name || "",
    radar1_distance_mi: radars[0]?.distance_mi ?? "",
    radar2: radars[1]?.id || "",
    radar2_name: radars[1]?.name || "",
    radar2_distance_mi: radars[1]?.distance_mi ?? "",
    radar3: radars[2]?.id || "",
    radar3_name: radars[2]?.name || "",
    radar3_distance_mi: radars[2]?.distance_mi ?? "",
    event_id: event.id,
    source: event.source,
    source_url: event.source_url,
  };
  return CSV_COLUMNS.map((column) => value[column]);
}

function enrichStateCountsFromDayFiles(summary) {
  for (const [day, value] of Object.entries(summary.days || {})) {
    const file = path.join(TARGET_DIR, `${day}.json`);
    if (!fs.existsSync(file)) continue;
    const payload = JSON.parse(fs.readFileSync(file, "utf8"));
    const events = Array.isArray(payload.events) ? payload.events : [];
    value.state_counts = stateCounts(events);
  }
}

function updateReadmeStats(summary) {
  const file = path.join(ROOT, "README.md");
  if (!fs.existsSync(file)) return;
  let text = fs.readFileSync(file, "utf8");
  text = text.replace(/Classified days with observed tornado radar targets: \d+/, `Classified days with observed tornado radar targets: ${summary.day_count}`);
  text = text.replace(/Observed tornado target rows: \d+/, `Observed tornado target rows: ${summary.event_count}`);
  text = text.replace(/latest NCEI Storm Events detail files for 2025-2026/, "latest NCEI Storm Events detail files plus SPC preliminary reports for recent 2026 days");
  fs.writeFileSync(file, text);
}

async function main() {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  const radars = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "radar_sites.json"), "utf8"));
  const records = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "classifications.json"), "utf8"));
  const classifiedDays = new Set(records.map((record) => record.day || record.convective_day).filter((day) => String(day).startsWith(`${TARGET_YEAR}-`)));
  const summary = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "tornado_radar_summary.json"), "utf8"));
  for (const day of Object.keys(summary.days || {})) {
    if (day.startsWith(`${TARGET_YEAR}-`)) delete summary.days[day];
  }

  const nceiRows = await fetchNceiRows();
  const nceiByDay = nceiEventsByDay(nceiRows, classifiedDays, radars);
  const generated = new Map();

  for (const day of [...classifiedDays].sort()) {
    let events = nceiByDay.get(day) || [];
    if (!events.length) {
      events = await fetchSpcTornadoReports(day);
      events = events.map((event) => {
        const nearest_radars = nearestRadars(radars, event.begin_lat, event.begin_lon, event.time_utc);
        return {
          ...event,
          nearest_radars,
          vwp_start_utc: shiftMinutes(event.time_utc, -VWP_WINDOW_MINUTES),
          vwp_target_utc: event.time_utc,
          vwp_end_utc: shiftMinutes(event.time_utc, VWP_WINDOW_MINUTES),
        };
      });
      events = applyOfficialSurveySupplements(day, events);
    }
    if (!events.length) continue;
    generated.set(day, events);
  }

  const metadata = {
    ...summary.metadata,
    generated_utc: iso(new Date()),
    recent_tornado_files: [
      "StormEvents_details-ftp_v1.0_d2025_c20260323.csv.gz",
      path.basename(new URL(NCEI_DETAILS_URL).pathname),
      "SPC *_rpts_filtered.csv preliminary reports for classified 2026 days missing NCEI tornado rows",
      "NWS Norman 2026 Oklahoma tornado table survey supplements for selected OUN preliminary rows",
    ],
    recent_tornado_coverage: "NCEI Storm Events latest available detail files plus SPC preliminary storm-report fallbacks and official NWS survey supplements for recent 2026 classified days",
    note: "Radar targets are the closest current NEXRAD sites to each tornado begin point; no radar files are downloaded. Recent SPC preliminary rows may have inferred EF labels from comments or official NWS survey supplements until NCEI ratings are available.",
  };

  for (const file of fs.readdirSync(TARGET_DIR)) {
    if (file.startsWith(`${TARGET_YEAR}-`) && file.endsWith(".json")) fs.unlinkSync(path.join(TARGET_DIR, file));
  }

  const newCsvRows = [];
  for (const [day, events] of [...generated.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const payload = summarizeDay(day, events, metadata);
    fs.writeFileSync(path.join(TARGET_DIR, `${day}.json`), `${JSON.stringify(payload)}\n`);
    const { events: _events, metadata: _metadata, convective_day: _day, ...daySummary } = payload;
    summary.days[day] = daySummary;
    for (const event of payload.events) newCsvRows.push(eventCsvRow(event));
  }

  enrichStateCountsFromDayFiles(summary);
  const orderedDays = Object.fromEntries(Object.entries(summary.days).sort(([a], [b]) => a.localeCompare(b)));
  summary.metadata = metadata;
  summary.days = orderedDays;
  summary.day_count = Object.keys(summary.days).length;
  summary.event_count = Object.values(summary.days).reduce((sum, day) => sum + (Number(day.tornado_count) || 0), 0);

  const csvPath = path.join(DATA_DIR, "tornado_radar_targets.csv");
  const currentCsv = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
  const existingRows = currentCsv.slice(1).filter((line) => !line.startsWith(`${TARGET_YEAR}-`));
  const rows = [
    CSV_COLUMNS.join(","),
    ...existingRows,
    ...newCsvRows.map(csvLine),
  ];
  fs.writeFileSync(csvPath, `${rows.join("\n")}\n`);
  fs.writeFileSync(path.join(DATA_DIR, "tornado_radar_summary.json"), `${JSON.stringify(summary)}\n`);
  fs.writeFileSync(path.join(DATA_DIR, "tornado_radar_targets.json"), `${JSON.stringify(summary)}\n`);
  updateReadmeStats(summary);

  console.log(`Updated ${generated.size} ${TARGET_YEAR} tornado-target days with ${newCsvRows.length} events.`);
  for (const [day, events] of generated) {
    const counts = stateCounts(events);
    console.log(`${day}: ${events.length} tor (${Object.entries(counts).map(([state, count]) => `${state}:${count}`).join(" ")})`);
  }
}

await main();
