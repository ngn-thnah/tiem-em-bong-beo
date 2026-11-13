import { CATEGORIES, DEFAULT_PRODUCTS, money, orderTotal, safeImg, fold, stats } from "./logic.js";

// shortcut: data lives in this browser's localStorage only, upgrade to a cloud DB if several phones must share orders.
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch { toast("⚠️ Không lưu được trên trình duyệt này"); } };

let products = load("bb-products", structuredClone(DEFAULT_PRODUCTS));
let orders = load("bb-orders", []);
let cart = {}; // productId -> qty
let cat = "Tất cả";
let orderFilter = "pending";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const thumb = (p) => { const src = safeImg(p.img); return src ? `<img src="${esc(src)}" alt="" loading="lazy">` : `<span class="emoji">${esc(p.emoji || "🍡")}</span>`; };
const time = (t) => new Date(t).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("show"), 1800);
}

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
    </button>`).join("") : `<p class="empty">Không tìm thấy món nào 😿</p>`;
}
function renderCart() {
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
  orders.unshift({ id: Date.now().toString(36), createdAt: Date.now(), items, customer: $("#c-name").value.trim(), note: $("#c-note").value.trim(), status: "pending" });
  save("bb-orders", orders);
  cart = {}; $("#c-name").value = ""; $("#c-note").value = "";
  renderSell(); renderCart(); renderBadge();
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
        ${o.status === "pending" ? `<button type="button" class="ghost" data-cancel="${o.id}">Hủy</button><button type="button" class="primary" data-done="${o.id}">Hoàn thành</button>` : ""}
      </footer>
    </article>`).join("") : `<p class="empty">Chưa có đơn nào ở đây.</p>`;
}
function setStatus(id, status) {
  const o = orders.find((x) => x.id === id);
  if (status === "cancelled" && !confirm("Hủy đơn này?")) return;
  o.status = status; save("bb-orders", orders);
  renderOrders(); renderBadge();
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
function saveProducts() { save("bb-products", products); renderProducts(); renderSell(); }

/* ---------- Thống kê ---------- */
function renderStats() {
  const s = stats(orders);
  $("#stats").innerHTML = [
    ["Hôm nay", money(s.today)], ["7 ngày qua", money(s.week)], ["Tổng doanh thu", money(s.all)],
    ["Đơn hoàn thành", s.doneCount], ["Đơn đang làm", s.pendingCount],
  ].map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join("");
  $("#top").innerHTML = s.top.length ? s.top.map(([n, q]) => `<li>${esc(n)} <span>${q} phần</span></li>`).join("") : `<p class="empty">Chưa có đơn hoàn thành.</p>`;
}

/* ---------- Sự kiện ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const d = b.dataset;
  if (d.tab) {
    document.querySelectorAll(".tab").forEach((t) => (t.hidden = t.id !== d.tab));
    document.querySelectorAll(".tabbar button").forEach((x) => x.classList.toggle("on", x === b));
    ({ "tab-don": renderOrders, "tab-sp": renderProducts, "tab-tk": renderStats })[d.tab]?.();
    renderCart();
    scrollTo(0, 0);
  } else if (d.add) addToCart(d.add, 1);
  else if (d.dec) addToCart(d.dec, -1);
  else if (d.cat) { cat = d.cat; renderChips(); renderSell(); }
  else if (d.filter) { orderFilter = d.filter; b.parentElement.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === b)); renderOrders(); }
  else if (d.done) setStatus(d.done, "done");
  else if (d.cancel) setStatus(d.cancel, "cancelled");
  else if (d.toggle) { const p = products.find((x) => x.id === d.toggle); p.hidden = !p.hidden; delete cart[p.id]; saveProducts(); renderCart(); }
  else if (d.del) { const p = products.find((x) => x.id === d.del); if (confirm(`Xóa “${p.name}”?`)) { products = products.filter((x) => x !== p); delete cart[p.id]; saveProducts(); renderCart(); } }
});
$("#search").addEventListener("input", renderSell);
$("#cart-submit").addEventListener("click", submitOrder);
$("#cartbar").addEventListener("click", () => $("#cart").scrollIntoView({ behavior: "smooth" }));
$("#cart-clear").addEventListener("click", () => { cart = {}; renderSell(); renderCart(); });
$("#reset").addEventListener("click", () => {
  if (!confirm("Đưa thực đơn về 6 món mẫu? (Đơn hàng giữ nguyên)")) return;
  products = structuredClone(DEFAULT_PRODUCTS); cart = {}; saveProducts(); renderCart();
});
$("#p-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const img = f.img.trim();
  if (img && !safeImg(img)) return toast("Link ảnh phải bắt đầu bằng https://");
  products.push({ id: "p" + Date.now().toString(36), name: f.name.trim(), desc: f.desc.trim(), price: Math.max(0, Math.round(+f.price)), emoji: f.emoji.trim() || "🍡", cat: f.cat, img, hidden: false });
  saveProducts(); e.target.reset(); toast("✨ Đã thêm " + f.name.trim());
});

$("#p-cat").innerHTML = CATEGORIES.map((c) => `<option>${c}</option>`).join("");
renderChips(); renderSell(); renderBadge();
