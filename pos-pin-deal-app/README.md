# Spooky Pin Deal: Enamel Pins 4 for $20

This is a Shopify discount app built on Shopify Functions. When a cart has 4 or
more products tagged **`Enamel Pins`**, each group of 4 rings up at **$20**.
It runs everywhere your automatic discounts run, including the **Shopify POS app**.
Nothing needs to be tapped at the register.

## How the deal works

| Pins in cart | Charged |
|---|---|
| 1–3 | full price |
| 4 × $8 | $20 (shows "Enamel Pins 4 for $20", $3 off each) |
| 5 × $8 | $20 + $8 = $28 |
| 8 × $8 | $40 |

- Any mix of pins counts. It does not matter which pins or which lines they are on.
- Pins that aren't all $8 (like $7.99, $8.95 and $9.95) still come to exactly $20 per group of 4. The priciest pins go into groups first, which gives the customer the better deal. Leftover pins ring up at full price.
- A group is never charged more than its regular price. If 4 pins already cost $20 or less, nothing changes.
- Eligibility uses the same `Enamel Pins` tag as your "Enamel Pins (Deal-Eligible)" collection. Tag a new pin and it's in the deal. `free-gift` items aren't included unless they're also tagged `Enamel Pins`.

## One-time setup

You need Node 20+ and a Shopify Partner or Dev Dashboard account that can
create apps for your store.

```bash
cd pos-pin-deal-app
npm install
npx shopify app config link    # create or pick the app; fills in client_id
npx shopify app deploy         # uploads the function
```

Then install the app on your store and turn the discount on:

1. Run `npx shopify app dev`. Choose your store, then approve the install when asked.
2. In the dev terminal, press **g** to open GraphiQL. Paste in
   `activate-discount.graphql` and run it. You should get a `discountId` and no `userErrors`.
3. Stop `app dev`. The deployed version keeps running.
4. In **Shopify admin → Discounts** you'll now see "Enamel Pins 4 for $20" as an
   active automatic discount. You can pause it, end it or schedule it there like any other discount.

## At the register (POS)

Add 4 or more pins to the cart as usual. The discount line "Enamel Pins 4 for $20"
appears on its own. If you don't see it, update the POS app and make sure the
discount is Active in admin.

## Changing the deal

The group size and price come from the discount's configuration metafield. For
example, to switch to 5 for $25, update the metafield value to
`{"bundleSize":5,"bundlePrice":25}` (or delete and re-create the discount with the new value).
To change which products count, edit the tag in
`extensions/pin-deal-discount/src/cart_lines_discounts_generate_run.graphql` and redeploy.

Combining: the discount combines with order and shipping discounts. It doesn't
stack with other product discounts, so a pin can't get two product discounts at once.

## Tests

```bash
npm test
```
