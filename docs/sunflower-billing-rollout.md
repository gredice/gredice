# Sunflower Billing Rollout

This checklist covers the first production rollout for sunflower package
purchases, order confirmation email, billing automation, and prepaid sunflower
ledger reconciliation.

## Entry Points

- Package catalog and eligibility:
  `packages/storage/src/repositories/sunflowerPackagesRepo.ts`.
- Package checkout and fulfillment:
  `apps/api/lib/stripe/processCheckoutSession.ts`.
- Package UI funnel:
  `packages/game/src/shared-ui/sunflowers/SunflowerPackagesPanel.tsx`.
- Ledger lifecycle:
  `packages/storage/src/repositories/sunflowerLedgerRepo.ts`.
- Admin sunflowers ledger view: `/admin/sunflowers`.
- Billing reconciliation: `/admin/billing/reconciliation`.

## Analytics

Client funnel events:

- `sunflower_package_catalog_viewed`: `package_count`,
  `initial_offer_count`, `main_package_count`.
- `sunflower_package_selected`: `package_code`, `package_role`,
  `price_cents`, `source`, `sunflowers`.
- `sunflower_package_upsell_shown`: `package_code`,
  `trigger_package_code`.
- `sunflower_package_upsell_accepted`: `package_code`,
  `trigger_package_code`.
- `sunflower_package_upsell_declined`: `package_code`,
  `upsell_package_code`.

Server fulfillment events:

- `sunflower_package_fulfilled`: `checkout_session_id`, `transaction_id`,
  `package_code`, `package_role`, `price_cents`, `paid_amount_cents`,
  `sunflowers`, `bonus_sunflowers`, `duplicate_one_time_purchase`,
  `ledger_entry_ids`.
- `sunflower_package_fulfillment_failed`: `checkout_session_id`,
  `package_code`, `reason`.
- `purchase_completed`: `amount_total`, `currency`, `item_count`,
  `checkout_session_id`.

## Ledger States

Sunflower ledger entry types are append-only:

- `top_up` and `top_up_bonus`: package purchase credit.
- `reservation`: prepaid operation or checkout reservation.
- `reservation_release`: unused reserved balance returned to available.
- `daily_capture`: daily prepaid capture.
- `refund`: support or automated refund.
- `correction` and `manual_adjustment`: support correction.
- `expiry`: expiration adjustment.

Every package fulfillment should connect the Stripe checkout session,
transaction, package code, price, credited sunflowers, and ledger entry IDs.

## Launch Order

1. Seed or verify the package catalog:

   ```bash
   pnpm --filter @gredice/storage sunflower-packages:seed
   ```

2. Keep `GREDICE_BILLING_AUTOMATION_ENABLED=false` and clear current rows in
   `/admin/billing/reconciliation`.
3. In preview, buy one normal package and one upsell path package.
4. Confirm `commerce-order-confirmation` is logged for the checkout.
5. Confirm the account sunflower balance changes in `/admin/sunflowers`.
6. Enable billing automation and repeat one low-risk checkout.
7. Confirm invoice document link, receipt document link, fiscalization status,
   and `commerce-billing-documents` delivery.
8. Confirm PostHog has the funnel and fulfillment events above.

## Reconciliation Checks

- Paid not credited: Stripe checkout completed and transaction exists, but no
  `top_up` ledger entry with the package code or checkout session metadata.
- Credited not documented: package `top_up` exists, but billing reconciliation
  shows missing invoice, receipt, fiscalization, or billing email.
- Reserved not captured: old `reservation` balance remains without matching
  `daily_capture` or `reservation_release`.
- Captured not documented: `daily_capture` exists but related operation,
  invoice, receipt, or billing metadata is missing.
- Refund or correction: `refund`, `correction`, `manual_adjustment`, and
  `expiry` entries have a support reason and idempotency key.

Use these admin pages first:

- `/admin/sunflowers` for account/user/time-filtered ledger events.
- `/admin/accounts/{accountId}` for customer balance and transaction context.
- `/admin/transactions` for payment records and invoice generation.
- `/admin/billing/reconciliation` for missing invoice, receipt,
  fiscalization, and billing email states.
- `/admin/communication/emails?status=failed` for failed email delivery.

## Rollback

Set `GREDICE_BILLING_AUTOMATION_ENABLED=false` to stop automatic billing
mutations. If package purchasing itself must pause, deactivate the sunflower
package entities or remove their Stripe lookup keys before re-enabling the
surface. Reconcile captured payments manually through the admin pages above.

## Validation

```bash
pnpm --filter api test:node processCheckoutSession.node.spec.ts
pnpm --filter @gredice/storage test:node sunflowerLedgerRepo.node.spec.ts billingReconciliationRepo.node.spec.ts
pnpm --filter app build
pnpm --filter app lint
pnpm --filter @gredice/storage lint
git diff --check
```
