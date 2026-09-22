# Customer operation request notes

Customers can optionally write a note when scheduling a raised-bed or plant-field
operation in Garden, including selected plantings, inventory purchases, photo
requests, and operation links in garden advice. The note is limited to 500
characters. Blank notes are omitted; leading and trailing whitespace is removed.
The cart displays the note before checkout.

The authenticated cart route validates and normalizes `additionalData.requestNote`.
Checkout forwards it for EUR, sunflower, and inventory purchases. Stripe product
metadata stores it separately as `operationRequestNote` so escaped JSON does not
push the note over Stripe's metadata value limit. Session verification reconstructs
the original additional data before checking its immutable fingerprint.

The checkout operation mapping includes the note in its retry fingerprint. The
first operation schedule event stores it as `requestNote`, and aggregate reads
preserve it through later scheduling, acceptance, and completion events. Existing
operations without notes need no backfill or schema migration.

Admin operation lists, details, and raised-bed schedules display the full note as
“Napomena korisnika” before approval. Farm schedule cards display it while doing
the work. It remains separate from the farmer's completion notes and is rendered
as plain text. The public garden operation projection does not expose it.

Relevant validation covers normalization, Stripe metadata round trips, all payment
currencies, field and bed fulfillment, replay conflicts, approval/rescheduling,
admin list serialization, the Garden form, and mobile Farm schedule cards.
