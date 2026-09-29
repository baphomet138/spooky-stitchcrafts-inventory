// @ts-check

/**
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} RunResult
 */

// "Enamel Pins 4 for $20". Both numbers can be overridden per discount via the
// $app:function-configuration metafield, e.g. {"bundleSize":4,"bundlePrice":20}.
const DEFAULT_BUNDLE_SIZE = 4;
const DEFAULT_BUNDLE_PRICE = 20;

/** @type {RunResult} */
const NO_CHANGES = { operations: [] };

const toCents = (amount) => Math.round(Number(amount) * 100);
const fromCents = (cents) => (cents / 100).toFixed(2);

/**
 * @param {RunInput} input
 * @returns {RunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  if (!input.discount.discountClasses.includes("PRODUCT")) {
    return NO_CHANGES;
  }

  const config = input.discount.metafield?.jsonValue ?? {};
  const bundleSize = Math.floor(Number(config.bundleSize ?? DEFAULT_BUNDLE_SIZE));
  const bundlePriceCents = toCents(config.bundlePrice ?? DEFAULT_BUNDLE_PRICE);
  if (!(bundleSize > 0) || !(bundlePriceCents >= 0)) {
    return NO_CHANGES;
  }

  // One entry per physical pin, so quantities across different pins mix freely.
  const units = [];
  for (const line of input.cart.lines) {
    if (line.merchandise.__typename !== "ProductVariant") continue;
    if (!line.merchandise.product.hasAnyTag) continue;
    const priceCents = toCents(line.cost.amountPerQuantity.amount);
    for (let i = 0; i < line.quantity; i++) {
      units.push({ lineId: line.id, priceCents });
    }
  }

  const bundleCount = Math.floor(units.length / bundleSize);
  if (bundleCount === 0) {
    return NO_CHANGES;
  }

  // Priciest pins go into bundles first so the customer gets the best deal;
  // leftover pins (fewer than a full bundle) ring up at full price.
  units.sort((a, b) => b.priceCents - a.priceCents);

  /** @type {Map<string, {cents: number, quantity: number}>} */
  const perLine = new Map();

  for (let b = 0; b < bundleCount; b++) {
    const bundle = units.slice(b * bundleSize, (b + 1) * bundleSize);
    const bundleTotal = bundle.reduce((sum, u) => sum + u.priceCents, 0);
    const bundleDiscount = bundleTotal - bundlePriceCents;
    if (bundleDiscount <= 0) continue;

    // Split the bundle's discount across its pins in proportion to price,
    // putting any rounding remainder on the last pin so the bundle is exact.
    let allocated = 0;
    bundle.forEach((unit, i) => {
      const share =
        i === bundle.length - 1
          ? bundleDiscount - allocated
          : Math.round((bundleDiscount * unit.priceCents) / bundleTotal);
      allocated += share;
      const entry = perLine.get(unit.lineId) ?? { cents: 0, quantity: 0 };
      entry.cents += share;
      entry.quantity += 1;
      perLine.set(unit.lineId, entry);
    });
  }

  if (perLine.size === 0) {
    return NO_CHANGES;
  }

  const message = `Enamel Pins ${bundleSize} for $${fromCents(bundlePriceCents).replace(/\.00$/, "")}`;
  const candidates = [...perLine].map(([lineId, { cents, quantity }]) => ({
    message,
    targets: [{ cartLine: { id: lineId, quantity } }],
    value: { fixedAmount: { amount: fromCents(cents), appliesToEachItem: false } },
  }));

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: /** @type {any} */ ("ALL"),
        },
      },
    ],
  };
}
