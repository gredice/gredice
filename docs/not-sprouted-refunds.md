# Plantings that did not sprout

A new `notSprouted` status event refunds the original planting charge in
sunflowers when its effective date is at least 15 complete days after the
recorded sowing date. Missing sowing dates and earlier effective dates do not
qualify. Euro purchases use the existing 1 cent = 10 sunflowers conversion;
inventory purchases have no refundable charge. Legacy purchases use the existing
cart/payment lookup when the placement event has no purchase metadata.

The planting's entire cycle history must contain no recorded sprout or later
growth stage, using the same `plantCycleHasSprouted` check as plant removal.
Resetting the current status does not erase that history. Such corrections
create neither an account credit nor a farmer payout deduction; in-game
confirmation and the status notification explain why no refund is issued.

The shared event writer handles legacy field and selected planting lifecycle
events from customer, admin and approved farmer requests. Status, settlement,
account credit and refund notification share a transaction. One durable
`planting.notSproutedRefund` event per planting prevents repeated credits and
deductions after corrections. Early changes send a no-refund notification;
there is no timer that refunds them later. Sandbox gardens have no economy.

The settlement snapshots 50% of the farm's configured direct or greenhouse
sowing rate in cents. Farmer earnings show a separate negative correction at
settlement time, including after the original sowing was already paid. Existing
payout requests and receipts remain historical snapshots. A missing configured
sowing rate records a zero deduction, matching the existing no-price earnings
behavior.

The public refund policy and FAQ hub render the shared policy directly. The
published `request-refund` FAQ answer also uses the current policy at read time
in every WWW placement, so an older directory answer cannot contradict it. The
public FAQ seed also contains the updated answer for future reviewed content
rollouts; deploying this change does not overwrite edited directory answers.
No schema migration or historical refund backfill is required.
