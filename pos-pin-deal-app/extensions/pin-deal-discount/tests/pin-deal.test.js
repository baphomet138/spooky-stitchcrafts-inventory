import { test } from "node:test";
import assert from "node:assert/strict";
import { cartLinesDiscountsGenerateRun as run } from "../src/cart_lines_discounts_generate_run.js";

const pin = (id, price, quantity = 1) => ({
  id: `gid://shopify/CartLine/${id}`,
  quantity,
  cost: { amountPerQuantity: { amount: String(price) } },
  merchandise: { __typename: "ProductVariant", product: { hasAnyTag: true } },
});
const notPin = (id, price, quantity = 1) => ({
  ...pin(id, price, quantity),
  merchandise: { __typename: "ProductVariant", product: { hasAnyTag: false } },
});
const input = (lines, { classes = ["PRODUCT"], config = null } = {}) => ({
  cart: { lines },
  discount: { discountClasses: classes, metafield: config && { jsonValue: config } },
});

const candidates = (result) => result.operations[0]?.productDiscountsAdd.candidates ?? [];
const totalOff = (result) =>
  candidates(result).reduce((sum, c) => sum + Math.round(Number(c.value.fixedAmount.amount) * 100), 0) / 100;

test("fewer than 4 pins: no discount", () => {
  assert.deepEqual(run(input([pin(1, 8, 3)])), { operations: [] });
});

test("4 x $8 pins on one line ring up at $20", () => {
  const result = run(input([pin(1, 8, 4)]));
  assert.equal(totalOff(result), 12);
  assert.deepEqual(candidates(result)[0].targets, [{ cartLine: { id: "gid://shopify/CartLine/1", quantity: 4 } }]);
  assert.equal(candidates(result)[0].message, "Enamel Pins 4 for $20");
  assert.equal(result.operations[0].productDiscountsAdd.selectionStrategy, "ALL");
});

test("4 different pins mix and match", () => {
  const result = run(input([pin(1, 8), pin(2, 8), pin(3, 8), pin(4, 8)]));
  assert.equal(candidates(result).length, 4);
  for (const c of candidates(result)) assert.equal(c.value.fixedAmount.amount, "3.00");
});

test("5 pins: one bundle, 5th pin full price", () => {
  const result = run(input([pin(1, 8, 5)]));
  assert.equal(totalOff(result), 12);
  assert.equal(candidates(result)[0].targets[0].cartLine.quantity, 4);
});

test("8 pins: two bundles = $40", () => {
  assert.equal(totalOff(run(input([pin(1, 8, 6), pin(2, 8, 2)]))), 24);
});

test("mixed prices: bundle totals exactly $20, priciest pins bundled first", () => {
  // 9.95 + 8.95 + 8 + 8 = 34.90 -> 20.00; the $7.99 pin stays full price.
  const result = run(input([pin(1, 9.95), pin(2, 8.95), pin(3, 8, 2), pin(4, 7.99)]));
  assert.equal(totalOff(result), 14.9);
  assert.ok(!candidates(result).some((c) => c.targets[0].cartLine.id.endsWith("/4")));
});

test("rounding: 4 x $7.99 = $31.96 -> exactly $20", () => {
  assert.equal(totalOff(run(input([pin(1, 7.99, 3), pin(2, 7.99)]))), 11.96);
});

test("non-pin items are ignored", () => {
  assert.deepEqual(run(input([pin(1, 8, 3), notPin(2, 12, 5)])), { operations: [] });
});

test("never raises the price when 4 pins already cost <= $20", () => {
  assert.deepEqual(run(input([pin(1, 4, 4)])), { operations: [] });
});

test("does nothing unless the discount has the PRODUCT class", () => {
  assert.deepEqual(run(input([pin(1, 8, 4)], { classes: ["ORDER"] })), { operations: [] });
});

test("config metafield can change the deal (5 for $25)", () => {
  const result = run(input([pin(1, 8, 5)], { config: { bundleSize: 5, bundlePrice: 25 } }));
  assert.equal(totalOff(result), 15);
  assert.equal(candidates(result)[0].message, "Enamel Pins 5 for $25");
});
