// Pure logic (no DOM) so it can be tested with `node test.mjs`.

export const CATEGORIES = ["Ăn vặt", "Đồ uống", "Tráng miệng"];

export const DEFAULT_PRODUCTS = [
  { id: "banh-trang-tron", name: "Bánh tráng trộn", desc: "Bánh tráng, trứng cút, khô bò, rau răm, sốt me", price: 25000, emoji: "🥢", cat: "Ăn vặt", img: "images/photos/banh-trang-tron.jpg", hidden: false },
  { id: "ca-vien-chien", name: "Cá viên chiên", desc: "Vàng giòn, chấm tương ớt ngọt cay", price: 15000, emoji: "🍢", cat: "Ăn vặt", img: "images/photos/ca-vien-chien.jpg", hidden: false },
  { id: "xoai-lac", name: "Xoài lắc muối tôm", desc: "Xoài keo giòn chua, muối tôm Tây Ninh", price: 20000, emoji: "🥭", cat: "Ăn vặt", img: "images/photos/xoai-lac.jpg", hidden: false },
  { id: "tra-sua", name: "Trà sữa trân châu", desc: "Trà đậm, sữa béo, trân châu nấu mỗi sáng", price: 30000, emoji: "🧋", cat: "Đồ uống", img: "images/photos/tra-sua.jpg", hidden: false },
  { id: "banh-flan", name: "Bánh flan caramel", desc: "Mềm mịn, thơm trứng sữa", price: 12000, emoji: "🍮", cat: "Tráng miệng", img: "images/photos/banh-flan.jpg", hidden: false },
  { id: "che-khuc-bach", name: "Chè khúc bạch", desc: "Khúc bạch sữa, nhãn, hạnh nhân, nước đường thanh", price: 28000, emoji: "🍧", cat: "Tráng miệng", img: "images/photos/che-khuc-bach.jpg", hidden: false },
];

export const money = (n) => n.toLocaleString("vi-VN") + "đ";

export const orderTotal = (items) => items.reduce((s, i) => s + i.price * i.qty, 0);

// Only http(s) links or files inside the site, so a pasted value can't run script.
export function safeImg(url) {
  const u = (url || "").trim();
  return /^https?:\/\//i.test(u) || /^images\//.test(u) ? u : "";
}

// Removes accents so "tra sua" finds "Trà sữa".
export const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function stats(orders, now = Date.now()) {
  const done = orders.filter((o) => o.status === "done");
  const today = startOfDay(now);
  const week = today - 6 * 86400000;
  const sum = (list) => list.reduce((s, o) => s + orderTotal(o.items), 0);
  const top = {};
  for (const o of done) for (const i of o.items) top[i.name] = (top[i.name] || 0) + i.qty;
  return {
    today: sum(done.filter((o) => o.createdAt >= today)),
    week: sum(done.filter((o) => o.createdAt >= week)),
    all: sum(done),
    doneCount: done.length,
    pendingCount: orders.filter((o) => o.status === "pending").length,
    top: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}
