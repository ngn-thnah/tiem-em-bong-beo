// Run: node test.mjs
import assert from "node:assert/strict";
import { orderTotal, stats, safeImg, fold, money } from "./logic.js";

assert.equal(orderTotal([{ price: 25000, qty: 2 }, { price: 12000, qty: 1 }]), 62000);
assert.equal(orderTotal([]), 0);

const now = new Date(2026, 10, 13, 15).getTime();
const day = 86400000;
const orders = [
  { status: "done", createdAt: now - 1000, items: [{ name: "A", price: 10000, qty: 2 }] },
  { status: "done", createdAt: now - 3 * day, items: [{ name: "B", price: 5000, qty: 1 }] },
  { status: "done", createdAt: now - 30 * day, items: [{ name: "A", price: 10000, qty: 1 }] },
  { status: "pending", createdAt: now, items: [{ name: "B", price: 5000, qty: 9 }] },
  { status: "cancelled", createdAt: now, items: [{ name: "B", price: 5000, qty: 9 }] },
];
const s = stats(orders, now);
assert.equal(s.today, 20000);
assert.equal(s.week, 25000);
assert.equal(s.all, 35000);
assert.equal(s.doneCount, 3);
assert.equal(s.pendingCount, 1);
assert.deepEqual(s.top, [["A", 3], ["B", 1]]);

assert.equal(safeImg("javascript:alert(1)"), "");
assert.equal(safeImg(" https://x.com/a.jpg "), "https://x.com/a.jpg");
assert.equal(safeImg("images/photos/a.jpg"), "images/photos/a.jpg");
assert.equal(fold("Trà Sữa Đậm"), "tra sua dam");
assert.match(money(25000), /^25.000đ$/);

console.log("OK – tất cả kiểm tra đều đúng");
