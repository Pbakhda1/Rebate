// Rebate — Savings + Rewards + Redemption + Bundles + Receipt Photos (LocalStorage demo)

const ENTRIES_KEY = "rebate_entries_v5";
const REDEEM_KEY  = "rebate_redemptions_v1";
const BUNDLE_KEY  = "rebate_bundles_v1";

/**
 * NOTE ABOUT STORAGE:
 * Receipt photos are stored in localStorage as compressed JPEG data URLs.
 * If you add tons of receipts, you might hit browser storage limits.
 * (This is normal for a no-backend demo.)
 */

// Prize tiers (net savings based)
const TIERS = [
  { name: "Starter", target: 500,  prize: "Bonus Entry (digital)" },
  { name: "Saver",   target: 1500, prize: "Gift Card Entry" },
  { name: "Super Saver", target: 3000, prize: "Monthly Prize Draw" },
  { name: "Elite Saver", target: 5000, prize: "Premium Prize Pack" }
];

const PRIZES = [
  { id: "starter_bonus", tierTarget: 500,  name: "Starter Bonus", detail: "Digital bonus entry / perk" },
  { id: "saver_gift",    tierTarget: 1500, name: "Saver Prize", detail: "Gift card entry (demo)" },
  { id: "super_draw",    tierTarget: 3000, name: "Super Saver Draw", detail: "Monthly prize draw entry (demo)" },
  { id: "elite_pack",    tierTarget: 5000, name: "Elite Prize Pack", detail: "Premium prize pack (demo)" }
];

// Demo manufacturer catalog
const CATALOG = {
  "Whirlpool": { "Appliances": [
    { sku: "WH-OVEN-01", name: "Whirlpool Oven", price: 1500 },
    { sku: "WH-FRIDGE-02", name: "Whirlpool Fridge", price: 2100 },
    { sku: "WH-DW-03", name: "Whirlpool Dishwasher", price: 900 },
    { sku: "WH-MW-04", name: "Whirlpool Microwave", price: 450 }
  ]},
  "Samsung": { "Appliances": [
    { sku: "SA-OVEN-01", name: "Samsung Oven", price: 1600 },
    { sku: "SA-FRIDGE-02", name: "Samsung Fridge", price: 2300 },
    { sku: "SA-WASH-03", name: "Samsung Washer", price: 1100 },
    { sku: "SA-DRY-04", name: "Samsung Dryer", price: 950 }
  ]},
  "LG": { "Appliances": [
    { sku: "LG-OVEN-01", name: "LG Oven", price: 1550 },
    { sku: "LG-FRIDGE-02", name: "LG Fridge", price: 2200 },
    { sku: "LG-RANGE-03", name: "LG Range", price: 1400 },
    { sku: "LG-DW-04", name: "LG Dishwasher", price: 880 }
  ]}
};

function money(n){
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { style:"currency", currency:"USD" });
}
function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function load(key){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }catch{
    return [];
  }
}
function save(key, data){
  localStorage.setItem(key, JSON.stringify(data));
}
function computeTotals(entries){
  let gross=0, fees=0;
  for(const e of entries){
    gross += Number(e.savings || 0);
    fees  += Number(e.fee || 0);
  }
  return { gross, fees, net: gross - fees };
}
function getNetSavings(){
  const entries = load(ENTRIES_KEY);
  const { net } = computeTotals(entries);
  return net;
}
function tierProgress(netSavings){
  const next = TIERS.find(t => netSavings < t.target) || TIERS[TIERS.length-1];
  const idx = TIERS.indexOf(next);
  const prevTarget = idx <= 0 ? 0 : TIERS[idx-1].target;

  const currentName =
    netSavings >= TIERS[TIERS.length-1].target
      ? TIERS[TIERS.length-1].name
      : (idx <= 0 ? TIERS[0].name : TIERS[idx-1].name);

  const span = next.target - prevTarget;
  const prog = span <= 0 ? 1 : (netSavings - prevTarget) / span;
  const pct = Math.max(0, Math.min(1, prog)) * 100;

  return { currentName, nextTarget: next.target, pct };
}

/* ---------- NEW: Receipt compression helpers ---------- */
async function fileToCompressedDataURL(file, { maxDim = 1280, quality = 0.72 } = {}) {
  // Only images
  if (!file || !file.type || !file.type.startsWith("image/")) return null;

  const img = await loadImageFromFile(file);

  // Compute scaled size
  let { width, height } = img;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  // Use jpeg to compress (smaller)
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return dataUrl;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

/* ---------- DASHBOARD (index.html) ---------- */
function initDashboard(){
  const form = document.getElementById("entryForm");
  if(!form) return;

  const storeEl = document.getElementById("store");
  const itemEl = document.getElementById("item");
  const savingsEl = document.getElementById("savings");
  const feeEl = document.getElementById("fee");
  const dateEl = document.getElementById("date");

  const receiptEl = document.getElementById("receipt");
  const receiptPreviewEl = document.getElementById("receiptPreview");
  const clearReceiptBtn = document.getElementById("clearReceiptBtn");

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

  // modal
  const modal = document.getElementById("receiptModal");
  const modalImg = document.getElementById("modalImg");
  const closeModalBtn = document.getElementById("closeModalBtn");

  let currentReceiptDataUrl = null;

  function openModal(dataUrl){
    if(!modal || !modalImg) return;
    modalImg.src = dataUrl;
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  }
  function closeModal(){
    if(!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    if (modalImg) modalImg.src = "";
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.getAttribute && target.getAttribute("data-close") === "1") closeModal();
    });
  }
  if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  function setReceiptPreview(dataUrl){
    currentReceiptDataUrl = dataUrl;
    if (!receiptPreviewEl) return;

    if (dataUrl) {
      receiptPreviewEl.src = dataUrl;
      receiptPreviewEl.style.display = "block";
    } else {
      receiptPreviewEl.src = "";
      receiptPreviewEl.style.display = "none";
    }
  }

  if (receiptEl) {
    receiptEl.addEventListener("change", async () => {
      const file = receiptEl.files && receiptEl.files[0];
      if(!file) {
        setReceiptPreview(null);
        return;
      }

      // Basic size guard before processing (still compresses after)
      const maxRawMB = 12;
      if (file.size > maxRawMB * 1024 * 1024) {
        alert(`That photo is too large (${Math.round(file.size/1024/1024)}MB). Try a smaller image.`);
        receiptEl.value = "";
        setReceiptPreview(null);
        return;
      }

      try{
        const dataUrl = await fileToCompressedDataURL(file, { maxDim: 1400, quality: 0.72 });
        setReceiptPreview(dataUrl);
      }catch{
        alert("Could not read that receipt image. Try again.");
        receiptEl.value = "";
        setReceiptPreview(null);
      }
    });
  }

  if (clearReceiptBtn) {
    clearReceiptBtn.addEventListener("click", () => {
      if (receiptEl) receiptEl.value = "";
      setReceiptPreview(null);
    });
  }

  function matchesSearch(e, q){
    if(!q) return true;
    const hay = `${e.store} ${e.item} ${e.date}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function renderTiers(netSavings){
    tiersListEl.innerHTML = "";
    for(const t of TIERS){
      const div = document.createElement("div");
      div.className = "tier-card";
      div.innerHTML = `
        <strong>${escapeHtml(t.name)}</strong>
        <div class="muted">Unlock at ${money(t.target)} • Prize: ${escapeHtml(t.prize)}</div>
      `;
      tiersListEl.appendChild(div);
    }

    const tp = tierProgress(netSavings);
    tierNameEl.textContent = tp.currentName;
    progressFillEl.style.width = `${tp.pct}%`;
    tierProgressTextEl.textContent = `${money(Math.max(0, netSavings))} / ${money(tp.nextTarget)}`;
  }

  function render(){
    const entries = load(ENTRIES_KEY);
    const q = (searchEl.value || "").trim();
    const filtered = entries.filter(e => matchesSearch(e, q));

    const { gross, fees, net } = computeTotals(entries);
    grossTotalEl.textContent = money(gross);
    feeTotalEl.textContent = money(fees);
    netTotalEl.textContent = money(net);
    entryCountEl.textContent = String(entries.length);

    renderTiers(net);

    tbody.innerHTML = "";
    emptyState.style.display = filtered.length === 0 ? "block" : "none";

    for(const e of filtered){
      const netRow = Number(e.savings || 0) - Number(e.fee || 0);
      const hasReceipt = !!e.receiptDataUrl;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(e.date || "—")}</td>
        <td>${escapeHtml(e.store || "—")}</td>
        <td>${escapeHtml(e.item || "")}</td>
        <td class="right">${money(e.savings)}</td>
        <td class="right">${money(e.fee)}</td>
        <td class="right">${money(netRow)}</td>
        <td>
          ${hasReceipt ? `<button class="btn" data-view="${escapeHtml(e.id)}">View</button>` : `<span class="muted small">—</span>`}
        </td>
        <td class="right"><button class="btn" data-del="${escapeHtml(e.id)}">Delete</button></td>
      `;
      tbody.appendChild(tr);
    }

    // delete buttons
    tbody.querySelectorAll("button[data-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-del");
        const updated = load(ENTRIES_KEY).filter(x => x.id !== id);
        save(ENTRIES_KEY, updated);
        render();
      });
    });

    // view receipt buttons
    tbody.querySelectorAll("button[data-view]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-view");
        const entry = load(ENTRIES_KEY).find(x => x.id === id);
        if (entry && entry.receiptDataUrl) openModal(entry.receiptDataUrl);
      });
    });
  }

  // init
  dateEl.value = todayISO();
  setReceiptPreview(null);
  render();

  // add entry
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();

    const store = (storeEl.value || "").trim();
    const item = (itemEl.value || "").trim();
    const savings = Number(savingsEl.value);
    const fee = Number(feeEl.value || 0);
    const date = (dateEl.value || todayISO()).trim();

    if(!store || !item) return;
    if(!Number.isFinite(savings) || savings < 0) return;
    if(!Number.isFinite(fee) || fee < 0) return;
    if(fee > savings){
      alert("Fee cannot be greater than savings for this entry.");
      return;
    }

    const entry = {
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
      store,
      item,
      savings,
      fee,
      date,
      receiptDataUrl: currentReceiptDataUrl || null
    };

    const updated = [entry, ...load(ENTRIES_KEY)];

    // localStorage can fail if too big
    try{
      save(ENTRIES_KEY, updated);
    }catch(err){
      alert("Storage is full (too many receipt photos). Try removing some receipts or using smaller photos.");
      return;
    }

    // reset
    storeEl.value = "";
    itemEl.value = "";
    savingsEl.value = "";
    feeEl.value = "";
    dateEl.value = todayISO();

    if (receiptEl) receiptEl.value = "";
    setReceiptPreview(null);

    render();
  });

  searchEl.addEventListener("input", render);

  clearAllBtn.addEventListener("click", () => {
    const ok = confirm("Clear ALL entries? This cannot be undone.");
    if(!ok) return;
    localStorage.removeItem(ENTRIES_KEY);
    render();
  });
}

/* ---------- REDEEM PAGE (redeem.html) ---------- */
function initRedeem(){
  const prizeList = document.getElementById("prizeList");
  if(!prizeList) return;

  const redeemNet = document.getElementById("redeemNet");
  const unlockedCount = document.getElementById("unlockedCount");
  const redeemedCount = document.getElementById("redeemedCount");
  const availableCount = document.getElementById("availableCount");

  const tbody = document.getElementById("redeemTbody");
  const empty = document.getElementById("redeemEmpty");
  const clearBtn = document.getElementById("clearRedemptionsBtn");

  function render(){
    const net = getNetSavings();
    const redemptions = load(REDEEM_KEY);

    redeemNet.textContent = money(net);

    const redeemedIds = new Set(redemptions.map(r => r.prizeId));
    const unlocked = PRIZES.filter(p => net >= p.tierTarget);
    const available = unlocked.filter(p => !redeemedIds.has(p.id));

    unlockedCount.textContent = String(unlocked.length);
    redeemedCount.textContent = String(redemptions.length);
    availableCount.textContent = String(available.length);

    prizeList.innerHTML = "";
    for(const p of PRIZES){
      const isUnlocked = net >= p.tierTarget;
      const isRedeemed = redeemedIds.has(p.id);

      const div = document.createElement("div");
      div.className = "prize";
      div.innerHTML = `
        <div>
          <div class="title">${escapeHtml(p.name)}</div>
          <div class="meta">
            <span class="badge ${isUnlocked ? "" : "locked"}">${isUnlocked ? "Unlocked" : "Locked"}</span>
            <span class="badge">${money(p.tierTarget)} tier</span>
            <div class="muted">${escapeHtml(p.detail)}</div>
          </div>
        </div>
        <div class="prize-actions">
          <div class="muted small">${isRedeemed ? "Already redeemed" : (isUnlocked ? "Ready to redeem" : "Not available yet")}</div>
          <button class="btn ${isUnlocked && !isRedeemed ? "primary" : ""}" ${isUnlocked && !isRedeemed ? "" : "disabled"}>
            ${isRedeemed ? "Redeemed" : (isUnlocked ? "Redeem" : "Locked")}
          </button>
        </div>
      `;

      const btn = div.querySelector("button");
      btn.addEventListener("click", () => {
        if(!isUnlocked || isRedeemed) return;

        const ok = confirm(`Redeem "${p.name}" now? (Demo records redemption)`);
        if(!ok) return;

        const updated = [
          {
            id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
            prizeId: p.id,
            prizeName: p.name,
            tierTarget: p.tierTarget,
            date: new Date().toISOString()
          },
          ...load(REDEEM_KEY)
        ];
        save(REDEEM_KEY, updated);
        render();
      });

      prizeList.appendChild(div);
    }

    tbody.innerHTML = "";
    empty.style.display = redemptions.length === 0 ? "block" : "none";

    for(const r of redemptions){
      const d = new Date(r.date);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(d.toLocaleString())}</td>
        <td>${escapeHtml(r.prizeName)}</td>
        <td class="right">${money(r.tierTarget)}</td>
        <td class="right">Redeemed</td>
      `;
      tbody.appendChild(tr);
    }
  }

  clearBtn.addEventListener("click", () => {
    const ok = confirm("Clear redemption history? This cannot be undone.");
    if(!ok) return;
    localStorage.removeItem(REDEEM_KEY);
    render();
  });

  render();
}

/* ---------- BUNDLES PAGE (bundles.html) ---------- */
function initBundles(){
  const mfgSelect = document.getElementById("mfgSelect");
  if(!mfgSelect) return;

  const catSelect = document.getElementById("catSelect");
  const bundleFeeInput = document.getElementById("bundleFee");
  const mfgDiscountInput = document.getElementById("mfgDiscount");

  const itemsWrap = document.getElementById("bundleItems");

  const outCount = document.getElementById("bundleCount");
  const outSubtotal = document.getElementById("bundleSubtotal");
  const outDiscount = document.getElementById("bundleDiscount");
  const outFee = document.getElementById("bundleFeeOut");
  const outTotal = document.getElementById("bundleTotal");

  const saveBtn = document.getElementById("saveBundleBtn");
  const tbody = document.getElementById("bundleTbody");
  const empty = document.getElementById("bundleEmpty");
  const clearBtn = document.getElementById("clearBundlesBtn");

  function manufacturers(){ return Object.keys(CATALOG); }
  function categories(mfg){ return Object.keys(CATALOG[mfg] || {}); }
  function items(mfg, cat){ return (CATALOG[mfg] && CATALOG[mfg][cat]) ? CATALOG[mfg][cat] : []; }

  function fillManufacturers(){
    mfgSelect.innerHTML = "";
    for(const m of manufacturers()){
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      mfgSelect.appendChild(opt);
    }
  }
  function fillCategories(){
    const m = mfgSelect.value;
    catSelect.innerHTML = "";
    for(const c of categories(m)){
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      catSelect.appendChild(opt);
    }
  }
  function selectedSkus(){
    return Array.from(itemsWrap.querySelectorAll("input[type=checkbox]:checked")).map(cb => cb.value);
  }

  function renderSummary(){
    const m = mfgSelect.value;
    const c = catSelect.value;
    const list = items(m, c);

    const skus = selectedSkus();
    let subtotal = 0;
    for(const it of list){
      if(skus.includes(it.sku)) subtotal += Number(it.price || 0);
    }

    const discount = Number(mfgDiscountInput.value || 0);
    const fee = Number(bundleFeeInput.value || 0);
    const total = Math.max(0, subtotal - discount) + fee;

    outCount.textContent = String(skus.length);
    outSubtotal.textContent = money(subtotal);
    outDiscount.textContent = money(discount);
    outFee.textContent = money(fee);
    outTotal.textContent = money(total);
  }

  function renderItems(){
    const m = mfgSelect.value;
    const c = catSelect.value;
    const list = items(m, c);

    itemsWrap.innerHTML = "";
    for(const it of list){
      const div = document.createElement("div");
      div.className = "bundle-item";
      div.innerHTML = `
        <label>
          <input type="checkbox" value="${escapeHtml(it.sku)}" />
          <div>
            <div><strong>${escapeHtml(it.name)}</strong></div>
            <div class="muted small">SKU: ${escapeHtml(it.sku)}</div>
          </div>
        </label>
        <div class="right"><strong>${money(it.price)}</strong></div>
      `;
      div.querySelector("input").addEventListener("change", renderSummary);
      itemsWrap.appendChild(div);
    }
    renderSummary();
  }

  function renderSavedBundles(){
    const bundles = load(BUNDLE_KEY);
    tbody.innerHTML = "";
    empty.style.display = bundles.length === 0 ? "block" : "none";

    for(const b of bundles){
      const d = new Date(b.date);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(d.toLocaleString())}</td>
        <td>${escapeHtml(b.manufacturer)}</td>
        <td>${escapeHtml(b.category)}</td>
        <td class="right">${escapeHtml(String(b.count))}</td>
        <td class="right">${money(b.subtotal)}</td>
        <td class="right">${money(b.discount)}</td>
        <td class="right">${money(b.fee)}</td>
        <td class="right">${money(b.total)}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  mfgSelect.addEventListener("change", () => { fillCategories(); renderItems(); });
  catSelect.addEventListener("change", renderItems);
  bundleFeeInput.addEventListener("input", renderSummary);
  mfgDiscountInput.addEventListener("input", renderSummary);

  saveBtn.addEventListener("click", () => {
    const m = mfgSelect.value;
    const c = catSelect.value;
    const skus = selectedSkus();
    if(skus.length === 0){
      alert("Select at least 1 bundle item.");
      return;
    }

    const list = items(m, c);
    let subtotal = 0;
    const chosen = [];
    for(const it of list){
      if(skus.includes(it.sku)){
        subtotal += Number(it.price || 0);
        chosen.push({ sku: it.sku, name: it.name, price: it.price });
      }
    }

    const discount = Number(mfgDiscountInput.value || 0);
    const fee = Number(bundleFeeInput.value || 0);
    const total = Math.max(0, subtotal - discount) + fee;

    const record = {
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
      date: new Date().toISOString(),
      manufacturer: m,
      category: c,
      items: chosen,
      count: chosen.length,
      subtotal,
      discount,
      fee,
      total
    };

    const updated = [record, ...load(BUNDLE_KEY)];
    save(BUNDLE_KEY, updated);

    alert("Bundle saved (demo).");
    renderSavedBundles();
  });

  clearBtn.addEventListener("click", () => {
    const ok = confirm("Clear all saved bundles? This cannot be undone.");
    if(!ok) return;
    localStorage.removeItem(BUNDLE_KEY);
    renderSavedBundles();
  });

  // init
  fillManufacturers();
  fillCategories();
  renderItems();
  renderSavedBundles();
}

// Boot all pages safely
initDashboard();
initRedeem();
initBundles();
