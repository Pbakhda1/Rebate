// Rebate — Savings Tracker
// Data is stored locally in the browser (localStorage).

const STORAGE_KEY = "rebate_entries_v1";

const form = document.getElementById("rebateForm");
const storeInput = document.getElementById("store");
const itemInput = document.getElementById("item");
const amountInput = document.getElementById("amount");
const dateInput = document.getElementById("date");

const totalSavingsEl = document.getElementById("totalSavings");
const entryCountEl = document.getElementById("entryCount");
const summaryHintEl = document.getElementById("summaryHint");

const tbody = document.getElementById("rebateTableBody");
const emptyState = document.getElementById("emptyState");

const searchInput = document.getElementById("search");
const clearAllBtn = document.getElementById("clearAllBtn");

function money(n) {
  const val = Number(n || 0);
  return val.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function safeText(s) {
  return String(s ?? "").trim();
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function computeTotal(entries) {
  return entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
}

function matchesSearch(entry, q) {
  if (!q) return true;
  const hay = `${entry.store} ${entry.item} ${entry.date}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

function render(entries) {
  const q = safeText(searchInput.value);
  const filtered = entries.filter(e => matchesSearch(e, q));

  // Summary
  const total = computeTotal(entries);
  totalSavingsEl.textContent = money(total);
  entryCountEl.textContent = String(entries.length);

  if (entries.length === 0) {
    summaryHintEl.textContent = "Add your first rebate below.";
  } else {
    summaryHintEl.textContent = `You’ve tracked ${money(total)} in total savings.`;
  }

  // Table
  tbody.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
  }

  for (const entry of filtered) {
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent = entry.date || "—";

    const tdStore = document.createElement("td");
    tdStore.innerHTML = entry.store
      ? `<span class="pill">${escapeHtml(entry.store)}</span>`
      : `<span class="muted">—</span>`;

    const tdItem = document.createElement("td");
    tdItem.textContent = entry.item || "";

    const tdAmt = document.createElement("td");
    tdAmt.className = "right";
    tdAmt.textContent = money(entry.amount);

    const tdAct = document.createElement("td");
    tdAct.className = "right";

    const btn = document.createElement("button");
    btn.className = "btn danger";
    btn.type = "button";
    btn.textContent = "Delete";
    btn.addEventListener("click", () => {
      const updated = loadEntries().filter(e => e.id !== entry.id);
      saveEntries(updated);
      render(updated);
    });

    tdAct.appendChild(btn);

    tr.appendChild(tdDate);
    tr.appendChild(tdStore);
    tr.appendChild(tdItem);
    tr.appendChild(tdAmt);
    tr.appendChild(tdAct);

    tbody.appendChild(tr);
  }
}

// Minimal HTML escape for safe pill rendering
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Init defaults
dateInput.value = todayISO();

let entries = loadEntries();
render(entries);

// Add entry
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const store = safeText(storeInput.value);
  const item = safeText(itemInput.value);
  const amount = Number(amountInput.value);
  const date = safeText(dateInput.value) || todayISO();

  if (!item) return;
  if (!Number.isFinite(amount) || amount < 0) return;

  const newEntry = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    store,
    item,
    amount,
    date
  };

  const updated = [newEntry, ...loadEntries()];
  saveEntries(updated);

  // reset
  storeInput.value = "";
  itemInput.value = "";
  amountInput.value = "";
  dateInput.value = todayISO();

  render(updated);
});

// Search
searchInput.addEventListener("input", () => {
  render(loadEntries());
});

// Clear all
clearAllBtn.addEventListener("click", () => {
  const ok = confirm("Clear ALL entries? This cannot be undone.");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  render([]);
});
