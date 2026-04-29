/**
 * ALMENTOR OPERATIONS DASHBOARD — script.js
 * ─────────────────────────────────────────
 * • Fetches two Google Sheets tabs via an Apps Script proxy
 * • Parses multiple tables separated by empty rows within each tab
 * • Renders each table in its own card with KPI summary
 * • Auto-refreshes every 15 seconds
 */

// ── Configuration ──────────────────────────────────────────────────────────
const PROXY_URL  = "https://script.google.com/macros/s/AKfycbwGwX7mq-AirS3J0paCkCt87i6FGWS9doCgmWGDBccRWOpE6IOX82GI42y5UlH3Y-qKKg/exec";
const REFRESH_MS = 15_000;  // 15 seconds

// ── State ───────────────────────────────────────────────────────────────────
let activeTab       = "tab1";
let refreshTimer    = null;
let isFirstLoad     = { tab1: true, tab2: true };

// ── DOM refs ────────────────────────────────────────────────────────────────
const els = {
  tabsGrid:    () => document.getElementById("tablesGrid"),
  loading:     () => document.getElementById("loadingState"),
  error:       () => document.getElementById("errorState"),
  errorMsg:    () => document.getElementById("errorMsg"),
  syncBadge:   () => document.getElementById("syncBadge"),
  syncLabel:   () => document.getElementById("syncLabel"),
  lastUpdated: () => document.getElementById("lastUpdated"),
  valProjects: () => document.getElementById("valProjects"),
  valTasks:    () => document.getElementById("valTasks"),
  valTables:   () => document.getElementById("valTables"),
};

// ── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("footerYear").textContent = new Date().getFullYear();

  // Tab buttons
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.tab === activeTab) return;
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeTab = btn.dataset.tab;
      clearInterval(refreshTimer);
      startRefreshCycle();
    });
  });

  startRefreshCycle();
});

// ── Refresh cycle ───────────────────────────────────────────────────────────
function startRefreshCycle() {
  fetchTab(activeTab);
  refreshTimer = setInterval(() => fetchTab(activeTab), REFRESH_MS);
}

// ── Fetch ───────────────────────────────────────────────────────────────────
async function fetchTab(tab) {
  setSyncState("loading");

  // Show skeleton loader only on first load
  if (isFirstLoad[tab]) {
    showLoading();
  }

  const url = `${PROXY_URL}?tab=${encodeURIComponent(tab)}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const raw = await res.json();
    const rows = normaliseResponse(raw);

    if (!rows || rows.length === 0) {
      throw new Error("No data returned from the sheet.");
    }

    const tables = splitIntoTables(rows);
    renderTables(tables);
    updateKPIs(tables);
    setSyncState("synced");
    updateTimestamp();
    isFirstLoad[tab] = false;
    hideError();

  } catch (err) {
    console.error("[Almentor Dashboard]", err);
    setSyncState("error");
    if (isFirstLoad[tab]) {
      showError(err.message);
    }
  }
}

// ── Response normaliser ──────────────────────────────────────────────────────
/**
 * Google Apps Script can return the sheet data in several shapes:
 *   { values: [[…], …] }   ← Sheets v4 style
 *   [[…], …]                ← flat 2-D array
 * Normalise to a 2-D array of strings.
 */
function normaliseResponse(raw) {
  if (Array.isArray(raw)) return raw.map(row => row.map(String));
  if (raw && Array.isArray(raw.values)) return raw.values.map(row => row.map(String));
  if (raw && Array.isArray(raw.data))   return raw.data.map(row => row.map(String));
  // Last resort: try to find any array property
  const key = Object.keys(raw || {}).find(k => Array.isArray(raw[k]));
  if (key) return raw[key].map(row => row.map(String));
  return null;
}

// ── Multi-table splitter ─────────────────────────────────────────────────────
/**
 * Splits a 2-D array of rows into multiple tables.
 * A row is considered "empty" when every cell is blank / undefined.
 * Returns an array of objects: { header: string[], rows: string[][] }
 */
function splitIntoTables(allRows) {
  const tables   = [];
  let block      = [];   // accumulates consecutive non-empty rows

  const isEmptyRow = row =>
    !row || row.length === 0 || row.every(cell => String(cell).trim() === "");

  const flushBlock = () => {
    if (block.length < 1) return;       // nothing to flush
    const nonEmpty = block.filter(r => !isEmptyRow(r));
    if (nonEmpty.length < 1) return;    // all empty
    const header = nonEmpty[0].map(c => String(c).trim());
    const rows   = nonEmpty.slice(1).map(r => {
      // Ensure every row has the same number of columns as header
      const padded = [...r];
      while (padded.length < header.length) padded.push("");
      return padded.map(c => String(c).trim());
    });
    if (header.some(h => h !== "")) {   // only add if header has content
      tables.push({ header, rows });
    }
    block = [];
  };

  for (const row of allRows) {
    if (isEmptyRow(row)) {
      flushBlock();
    } else {
      block.push(row);
    }
  }
  flushBlock();   // flush last block

  return tables;
}

// ── Renderers ───────────────────────────────────────────────────────────────
function renderTables(tables) {
  const grid = els.tabsGrid();
  grid.innerHTML = "";

  if (tables.length === 0) {
    grid.innerHTML = `<p class="no-data">No tables found in this sheet.</p>`;
    return;
  }

  tables.forEach((tbl, idx) => {
    const card = buildTableCard(tbl, idx + 1);
    grid.appendChild(card);
    // Stagger animation
    card.style.animationDelay = `${idx * 60}ms`;
  });

  hideLoading();
}

function buildTableCard(tbl, tableNum) {
  const card = document.createElement("div");
  card.className = "table-card";

  // Header bar
  const titleText = inferTitle(tbl.header, tableNum);
  card.innerHTML = `
    <div class="table-card-header">
      <div class="table-card-title">${escHtml(titleText)}</div>
      <span class="table-row-count">${tbl.rows.length} row${tbl.rows.length !== 1 ? "s" : ""}</span>
    </div>
    <div class="table-scroll">
      ${buildHtmlTable(tbl)}
    </div>
  `;
  return card;
}

/**
 * Try to infer a descriptive title from the first non-generic header cell.
 */
function inferTitle(header, fallbackNum) {
  const skip = /^(#|no|sr|sl|id|s\.no)$/i;
  const candidate = header.find(h => h && !skip.test(h.trim()));
  return candidate
    ? `Section ${fallbackNum} — ${candidate}`
    : `Data Section ${fallbackNum}`;
}

function buildHtmlTable({ header, rows }) {
  const thead = header.map(h => `<th>${escHtml(h)}</th>`).join("");
  const tbody = rows.map(row => {
    const cells = header.map((_, i) => `<td>${escHtml(row[i] ?? "")}</td>`).join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  return `
    <table>
      <thead><tr>${thead}</tr></thead>
      <tbody>${tbody || "<tr><td colspan=\"" + header.length + "\">No data rows</td></tr>"}</tbody>
    </table>
  `;
}

// ── KPI Calculator ───────────────────────────────────────────────────────────
/**
 * Heuristics for "projects" and "tasks":
 *   - totalRows across all tables = Total Tasks (data rows, not headers)
 *   - tables count = Data Sections
 *   - "projects" = rows in the table whose header contains "project" keyword,
 *     or if none found, the row count of the largest table
 */
function updateKPIs(tables) {
  const totalRows = tables.reduce((sum, t) => sum + t.rows.length, 0);

  // Find table most likely representing projects
  const projectTable =
    tables.find(t => t.header.some(h => /project/i.test(h))) ||
    tables.reduce((best, t) => (!best || t.rows.length > best.rows.length) ? t : best, null);

  const projectCount = projectTable ? projectTable.rows.length : totalRows;

  animateCount(els.valProjects(), projectCount);
  animateCount(els.valTasks(),    totalRows);
  animateCount(els.valTables(),   tables.length);
}

function animateCount(el, target) {
  if (!el) return;
  const start    = parseInt(el.textContent) || 0;
  const duration = 600;
  const startTs  = performance.now();

  const step = (ts) => {
    const progress = Math.min((ts - startTs) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── UI helpers ───────────────────────────────────────────────────────────────
function showLoading() {
  els.loading().classList.remove("hidden");
  els.tabsGrid().innerHTML = "";
  hideError();
}
function hideLoading() {
  els.loading().classList.add("hidden");
}
function showError(msg) {
  hideLoading();
  els.error().classList.remove("hidden");
  if (msg) els.errorMsg().textContent = msg;
}
function hideError() {
  els.error().classList.add("hidden");
}

function setSyncState(state) {
  const badge = els.syncBadge();
  const label = els.syncLabel();
  badge.className = "sync-badge";
  if (state === "synced") {
    badge.classList.add("synced");
    label.textContent = "Live";
  } else if (state === "error") {
    badge.classList.add("error");
    label.textContent = "Error";
  } else {
    label.textContent = "Syncing…";
  }
}

function updateTimestamp() {
  const now = new Date();
  const fmt = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  els.lastUpdated().textContent = `Last sync: ${fmt}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
