// Tune Pin — Savings & Rewards Demo
// Stores entries in localStorage so the data stays after refresh.

const STORAGE_KEY = "tunepin_entries_v1";

const form = document.getElementById("entryForm");
const storeEl = document.getElementById("store");
const itemEl = document.getElementById("item");
const savingsEl = document.getElementById("savings");
const feeEl = document.getElementById("fee");
const dateEl = document.getElementById("date");

const grossTotalEl = document.getElementById("grossTotal");
const feeTotalEl = document.getElementById("feeTotal");
const netTotalEl = document.getElementById("netTotal");
const entryCountEl = document.getElementById("entryCount");

const tbody = document.getElementById("tbody");
const emptyState = document.getElementById("emptyState");

const searchEl = document.getElementById("search");
const clearAllBtn = document.getElementById("clearAllBtn");

const tierNameEl = document.getElementById("tierName");
const tierProgressTextEl = document.getElementById("tierProgressText");
const progressFillEl = document.getElementById("progressFill");
const tiersListEl = document.getElementById("tiersList");

// You can customize these prize tiers anytime:
const TIERS = [
  { name: "Starter", target: 500, prize: "Mystery Bonus (digital)" },
  { name: "Saver", target: 1500, prize: "Gift Card Entry" },
  { name: "Super Saver", target: 3000, prize: "Monthly Prize Draw" },
  { name: "Elite Saver", target: 5000, prize: "Premium Prize Pack" }
];

function money(n) {
  const val = Number(n || 0);
  return val.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

function computeTotals(entries) {
  let gross = 0;
  let fees = 0;
  for (const e of entries) {
    gross += Number(e.savings || 0);
    fees += Number(e.fee || 0);
  }
  const net = gross - fees;
  return { gross, fees, net };
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderTiers(netSavings) {
  // Render tier cards
  tiersListEl.innerHTML = "";
  for (const t of TIERS) {
    const div = document.createElement("div");
    div.className = "tier-card";
    div.innerHTML = `
      <strong>${escapeHtml(t.name)}</strong>
      <div class="muted">Unlock at ${money(t.target)} • Prize: ${escapeHtml(t.prize)}</div>
    `;
    tiersListEl.appendChild(div);
  }

  // Find current/next tier based on NET savings (you can switch to gross if you prefer)
  const nextTier = TIERS.find(t => netSavings < t.target) || TIERS[TIERS.length - 1];
  const prevTarget = (() => {
    const idx = TIERS.indexOf(nextTier);
    return idx <= 0 ? 0 : TIERS[idx - 1].target;
  })();

  const currentName = (() => {
    if (netSavings >= TIERS[TIERS.length - 1].target) return TIERS[TIERS.length - 1].name;
    const idx = TIERS.indexOf(nextTier);
    return idx <= 0 ? TIERS[0].name : TIERS[idx - 1].name;
  })();

  tierNameEl.textContent = currentName;

  const span = nextTier.target - prevTarget;
  const progress = span <= 0 ? 1 : (netSavings - prevTarget) / span;
  const clamped = Math.max(0, Math.min(1, progress));
  progressFillEl.style.width = `${clamped * 100}%`;

  const shownTarget = nextTier.target;
  tierProgressTextEl.textContent = `${money(Math.max(0, netSavings))} / ${money(shownTarget)}`;
}

function matchesSearch(e, q) {
  if (!q) return true;
  const hay = `${e.store} ${e.item} ${e.date}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

function render() {
  const entries = loadEntries();
  const q = (searchEl.value || "").trim();
  const filtered = entries.filter(e => matchesSearch(e, q));

  // Totals
  const { gross, fees, net } = computeTotals(entries);
  grossTotalEl.textContent = money(gross);
  feeTotalEl.textContent = money(fees);
  netTotalEl.textContent = money(net);
  entryCountEl.textContent = String(entries.length);

  // Rewards
  renderTiers(net);

  // Table
  tbody.innerHTML = "";
  if (filtered.length === 0) {
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
  }

  for (const e of filtered) {
    const tr = document.createElement("tr");

    const netRow = Number(e.savings || 0) - Number(e.fee || 0);

    tr.innerHTML = `
      <td>${escapeHtml(e.date || "—")}</td>
      <td>${e.store ? `<span class="pill">${escapeHtml(e.store)}</span>` : `<span class="muted">—</span>`}</td>
      <td>${escapeHtml(e.item || "")}</td>
      <td class="right">${money(e.savings)}</td>
      <td class="right">${money(e.fee)}</td>
      <td class="right">${money(netRow)}</td>
      <td class="right"><button class="btn" data-del="${escapeHtml(e.id)}">Delete</button></td>
    `;

    tbody.appendChild(tr);
  }

  // wire delete buttons
  tbody.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del");
      const updated = loadEntries().filter(x => x.id !== id);
      saveEntries(updated);
      render();
    });
  });
}

// Init
dateEl.value = todayISO();
render();

// Add entry
form.addEventListener("submit", (ev) => {
  ev.preventDefault();

  const store = (storeEl.value || "").trim();
  const item = (itemEl.value || "").trim();
  const savings = Number(savingsEl.value);
  const fee = Number(feeEl.value || 0);
  const date = (dateEl.value || todayISO()).trim();

  if (!store || !item) return;
  if (!Number.isFinite(savings) || savings < 0) return;
  if (!Number.isFinite(fee) || fee < 0) return;
  if (fee > savings) {
    alert("Fee cannot be greater than savings for this entry.");
    return;
  }

  const entry = {
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
    store,
    item,
    savings,
    fee,
    date
  };

  const updated = [entry, ...loadEntries()];
  saveEntries(updated);

  // reset
  storeEl.value = "";
  itemEl.value = "";
  savingsEl.value = "";
  feeEl.value = "";
  dateEl.value = todayISO();

  render();
});

// Search
searchEl.addEventListener("input", () => render());

// Clear all
clearAllBtn.addEventListener("click", () => {
  const ok = confirm("Clear ALL entries? This cannot be undone.");
  if (!ok) return;
  localStorage.removeItem("tunepin_entries_v1");
  render();
});
