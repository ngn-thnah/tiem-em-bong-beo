import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, query, orderBy, limit,
  onSnapshot, setDoc, updateDoc,
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { CATEGORIES, DEFAULT_PRODUCTS, money, orderTotal, safeImg, fold, stats } from "./logic.js";

// Public web config (not a secret). Access is guarded by the shop code + firestore.rules.
const app = initializeApp({
  apiKey: "AIzaSyAxCx3ZrOk8o2O_FMUI_jjgvV0mNu_MEeo",
  authDomain: "tiem-em-bong-beo-5e22.firebaseapp.com",
  projectId: "tiem-em-bong-beo-5e22",
  storageBucket: "tiem-em-bong-beo-5e22.firebasestorage.app",
  messagingSenderId: "205923619786",
  appId: "1:205923619786:web:bb4bcbc865ee1004413533",
});
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const thumb = (p) => { const src = safeImg(p.img); return src ? `<img src="${esc(src)}" alt="" loading="lazy">` : `<span class="emoji">${esc(p.emoji || "🍡")}</span>`; };
const time = (t) => new Date(t).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("show"), 2200);
}
const fail = (e) => { console.error(e); toast("⚠️ Không lưu được: " + (e.code === "permission-denied" ? "mã tiệm không đúng" : "lỗi mạng")); };

/* ---------- Mã tiệm ---------- */
// The code travels in the URL hash (#k=…), which browsers never send to any server.
const fromHash = new URLSearchParams(location.hash.slice(1)).get("k");
if (fromHash) { store.set("bb-key", fromHash); history.replaceState(null, "", location.pathname); }
addEventListener("hashchange", () => location.hash.includes("k=") && location.reload());
const KEY = store.get("bb-key");
const keyOk = (k) => /^[A-Za-z0-9_-]{32,}$/.test(k || "");

let products = [];
let orders = [];
let cart = {}; // productId -> qty
let cat = "Tất cả";
let orderFilter = "pending";
let shopRef, ordersCol;

const saveProducts = () => setDoc(shopRef, { products, updatedAt: Date.now() }).catch(fail);

/* ---------- Bán hàng ---------- */
function renderChips() {
  $("#chips").innerHTML = ["Tất cả", ...CATEGORIES].map((c) => `<button type="button" class="chip${c === cat ? " on" : ""}" data-cat="${c}">${c}</button>`).join("");
}
function renderSell() {
  const q = fold($("#search").value.trim());
  const list = products.filter((p) => !p.hidden && (cat === "Tất cả" || p.cat === cat) && fold(p.name + " " + p.desc).includes(q));
  $("#sell-grid").innerHTML = list.length ? list.map((p) => `
    <button type="button" class="sell-card" data-add="${esc(p.id)}">
      ${thumb(p)}
      ${cart[p.id] ? `<b class="qty">${cart[p.id]}</b>` : ""}
      <span class="name">${esc(p.name)}</span>
      <span class="price">${money(p.price)}</span>
    </button>`).join("") : `<p class="empty">${products.length ? "Không tìm thấy món nào 😿" : "Đang tải thực đơn…"}</p>`;
}
function renderCart() {
  for (const id in cart) if (!products.some((p) => p.id === id && !p.hidden)) delete cart[id];
  const items = Object.entries(cart).map(([id, qty]) => ({ ...products.find((p) => p.id === id), qty }));
  $("#cart").hidden = !items.length;
  $("#cart-items").innerHTML = items.map((i) => `
    <li><span>${esc(i.name)}</span>
      <span class="stepper"><button type="button" data-dec="${esc(i.id)}" aria-label="Bớt">−</button><b>${i.qty}</b><button type="button" data-add="${esc(i.id)}" aria-label="Thêm">+</button></span>
      <span>${money(i.price * i.qty)}</span></li>`).join("");
  $("#cart-total").textContent = money(orderTotal(items));
  $("#cartbar").hidden = !items.length || $("#tab-ban").hidden;
  $("#cartbar-text").textContent = `${items.reduce((s, i) => s + i.qty, 0)} món · ${money(orderTotal(items))}`;
}
function addToCart(id, d) {
  cart[id] = (cart[id] || 0) + d;
  if (cart[id] <= 0) delete cart[id];
  renderSell(); renderCart();
}
function submitOrder() {
  const items = Object.entries(cart).map(([id, qty]) => { const p = products.find((x) => x.id === id); return { id, name: p.name, price: p.price, qty }; });
  if (!items.length) return;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  // No await: the local cache shows the order at once and syncs when online.
  setDoc(doc(ordersCol, id), { createdAt: Date.now(), items, customer: $("#c-name").value.trim(), note: $("#c-note").value.trim(), status: "pending" }).catch(fail);
  cart = {}; $("#c-name").value = ""; $("#c-note").value = "";
  renderSell(); renderCart();
  toast("✅ Đã tạo đơn " + money(orderTotal(items)));
}

/* ---------- Đơn hàng ---------- */
function renderOrders() {
  const list = orders.filter((o) => o.status === orderFilter);
  $("#order-list").innerHTML = list.length ? list.map((o) => `
    <article class="order">
      <header><b>${esc(o.customer || "Khách lẻ")}</b><small>${time(o.createdAt)}</small></header>
      <ul>${o.items.map((i) => `<li>${i.qty} × ${esc(i.name)} <span>${money(i.price * i.qty)}</span></li>`).join("")}</ul>
      ${o.note ? `<p class="onote">📝 ${esc(o.note)}</p>` : ""}
      <footer><b>${money(orderTotal(o.items))}</b>
        ${o.status === "pending" ? `<button type="button" class="ghost" data-cancel="${esc(o.id)}">Hủy</button><button type="button" class="primary" data-done="${esc(o.id)}">Hoàn thành</button>` : ""}
      </footer>
    </article>`).join("") : `<p class="empty">Chưa có đơn nào ở đây.</p>`;
}
function setStatus(id, status) {
  if (status === "cancelled" && !confirm("Hủy đơn này?")) return;
  updateDoc(doc(ordersCol, id), { status, doneAt: Date.now() }).catch(fail);
  toast(status === "done" ? "🎉 Đơn đã hoàn thành" : "Đã hủy đơn");
}
function renderBadge() {
  const n = orders.filter((o) => o.status === "pending").length;
  $("#badge").hidden = !n; $("#badge").textContent = n;
}

/* ---------- Sản phẩm ---------- */
function renderProducts() {
  $("#p-list").innerHTML = products.map((p) => `
    <div class="p-row${p.hidden ? " off" : ""}">
      ${thumb(p)}
      <div><b>${esc(p.name)}</b><small>${esc(p.cat)} · ${money(p.price)}${p.hidden ? " · đang ẩn" : ""}</small></div>
      <button type="button" class="ghost" data-toggle="${esc(p.id)}">${p.hidden ? "Hiện" : "Ẩn"}</button>
      <button type="button" class="ghost danger" data-del="${esc(p.id)}" aria-label="Xóa ${esc(p.name)}">🗑</button>
    </div>`).join("");
}

/* ---------- Thống kê ---------- */
function renderStats() {
  const s = stats(orders);
  $("#stats").innerHTML = [
    ["Hôm nay", money(s.today)], ["7 ngày qua", money(s.week)], ["Tổng doanh thu", money(s.all)],
    ["Đơn hoàn thành", s.doneCount], ["Đơn đang làm", s.pendingCount],
  ].map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join("");
  $("#top").innerHTML = s.top.length ? s.top.map(([n, q]) => `<li>${esc(n)} <span>${q} phần</span></li>`).join("") : `<p class="empty">Chưa có đơn hoàn thành.</p>`;
}

const currentTab = () => document.querySelector(".tab:not([hidden])")?.id;
function renderAll() {
  renderSell(); renderCart(); renderBadge();
  ({ "tab-don": renderOrders, "tab-sp": renderProducts, "tab-tk": renderStats })[currentTab()]?.();
}

/* ---------- Đồng bộ ---------- */
function setSync(text, ok) { $("#sync").textContent = text; $("#sync").classList.toggle("ok", ok); }
function connect() {
  shopRef = doc(db, "shops", KEY);
  ordersCol = collection(shopRef, "orders");
  onSnapshot(shopRef, { includeMetadataChanges: true }, (snap) => {
    setSync(snap.metadata.fromCache ? "● Đang chờ mạng…" : "● Đã đồng bộ", !snap.metadata.fromCache);
    if (!snap.exists()) { if (!snap.metadata.fromCache) { products = structuredClone(DEFAULT_PRODUCTS); saveProducts(); } return; }
    products = snap.data().products || [];
    renderAll();
  }, (e) => { setSync("● Mã tiệm không đúng", false); fail(e); });
  // shortcut: shows the newest 500 orders only, add paging or monthly archives if the shop grows past that.
  onSnapshot(query(ordersCol, orderBy("createdAt", "desc"), limit(500)), (snap) => {
    orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  }, fail);
}

/* ---------- Sự kiện ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const d = b.dataset;
  if (d.tab) {
    document.querySelectorAll(".tab").forEach((t) => (t.hidden = t.id !== d.tab));
    document.querySelectorAll(".tabbar button").forEach((x) => x.classList.toggle("on", x === b));
    renderAll();
    scrollTo(0, 0);
  } else if (d.add) addToCart(d.add, 1);
  else if (d.dec) addToCart(d.dec, -1);
  else if (d.cat) { cat = d.cat; renderChips(); renderSell(); }
  else if (d.filter) { orderFilter = d.filter; b.parentElement.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === b)); renderOrders(); }
  else if (d.done) setStatus(d.done, "done");
  else if (d.cancel) setStatus(d.cancel, "cancelled");
  else if (d.toggle) { products = products.map((p) => (p.id === d.toggle ? { ...p, hidden: !p.hidden } : p)); saveProducts(); }
  else if (d.del) { const p = products.find((x) => x.id === d.del); if (confirm(`Xóa “${p.name}”?`)) { products = products.filter((x) => x !== p); saveProducts(); } }
});
$("#search").addEventListener("input", renderSell);
$("#cart-submit").addEventListener("click", submitOrder);
$("#cartbar").addEventListener("click", () => $("#cart").scrollIntoView({ behavior: "smooth" }));
$("#cart-clear").addEventListener("click", () => { cart = {}; renderSell(); renderCart(); });
$("#reset").addEventListener("click", () => {
  if (!confirm("Đưa thực đơn về 6 món mẫu? (Đơn hàng giữ nguyên)")) return;
  products = structuredClone(DEFAULT_PRODUCTS); saveProducts();
});
$("#p-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const img = f.img.trim();
  if (img && !safeImg(img)) return toast("Link ảnh phải bắt đầu bằng https://");
  products = [...products, { id: "p" + Date.now().toString(36), name: f.name.trim(), desc: f.desc.trim(), price: Math.max(0, Math.round(+f.price)), emoji: f.emoji.trim() || "🍡", cat: f.cat, img, hidden: false }];
  saveProducts(); e.target.reset(); toast("✨ Đã thêm " + f.name.trim());
});
$("#share").addEventListener("click", async () => {
  const link = `${location.origin}${location.pathname}#k=${KEY}`;
  try { await navigator.clipboard.writeText(link); toast("📋 Đã chép link, gửi riêng cho người làm của tiệm"); }
  catch { prompt("Chép link này gửi riêng cho người làm của tiệm:", link); }
});
$("#logout").addEventListener("click", () => {
  if (confirm("Gỡ mã tiệm khỏi máy này? Muốn vào lại phải có link mời.")) { store.set("bb-key", null); location.reload(); }
});
$("#lock-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = e.target.code.value.trim();
  const k = new URLSearchParams(v.split("#")[1] || "").get("k") || v; // accepts the whole link or just the code
  if (!keyOk(k)) return toast("Mã tiệm không hợp lệ");
  store.set("bb-key", k); location.reload();
});

$("#p-cat").innerHTML = CATEGORIES.map((c) => `<option>${c}</option>`).join("");
if (keyOk(KEY)) {
  renderChips(); renderSell(); connect();
} else {
  document.querySelectorAll(".tab").forEach((t) => (t.hidden = t.id !== "tab-lock"));
  $(".tabbar").hidden = true;
  setSync("● Chưa có mã tiệm", false);
}
