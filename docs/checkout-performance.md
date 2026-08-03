# Checkout performance

The cart checkout route emits one `checkout.request.complete` record after each
request that reaches `/api/checkout/checkout`. The record is intended for
aggregate latency analysis, not customer or order debugging.

## Fields

- `route`: stable route name.
- `statusCode`: final HTTP status, or `500` for an unhandled exception.
- `outcome`: `success`, `rejected`, `failed`, or `unexpected_failure`.
- `paymentKind`: `sunflower`, `inventory`, `mixed_non_stripe`, `stripe`, or
  `unknown` when auth or validation ends the request before the cart is loaded.
- `itemCountBucket`: pending-item count as `0`, `1`, `2-3`, `4-10`, `11+`, or
  `unknown`.
- `totalDurationMs`: monotonic time from checkout middleware entry through the
  final response.
- Optional monotonic phase fields: `accountCartLoadDurationMs`,
  `cartNormalizationDurationMs`, `deliveryValidationDurationMs`,
  `cartEnrichmentDurationMs`, `nonStripeFulfillmentDurationMs`,
  `confirmationSideEffectsDurationMs`, `stripeSessionDurationMs`, and
  `analyticsDurationMs`.
- `errorCategory`: a bounded internal category when the route recovers from a
  known failure before producing a response.

The record never includes recipient, user, account, cart, address, delivery
notes, cart contents, entity data, price, balance, Stripe identifiers, token,
cookie, header, or arbitrary error values.

## Production readback

1. Filter API logs to the exact `checkout.request.complete` event.
2. Select a release-bounded time window and record the deployed commit.
3. Group by `paymentKind`, `itemCountBucket`, `outcome`, and `statusCode`.
4. Report sample count plus p50, p90, and p95 for `totalDurationMs` and each
   applicable phase. Omitted phases are not zero-duration samples.
5. Compare equivalent windows before and after a checkout change. Keep cold
   starts and unexpected failures visible rather than removing outliers.

The optimization target for sunflower-only carts containing up to ten items is
p50 below 500 ms and p95 below 1 second. A release is not verified by CI alone:
the target requires production readback with a representative sample.
