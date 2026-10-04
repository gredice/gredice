# Billing Automation

Billing document automation is guarded by `GREDICE_BILLING_AUTOMATION_ENABLED`.
The flag controls automatic checkout-driven invoice creation, receipt issuing,
receipt fiscalization, and billing document email delivery. Manual admin
workflows stay available while automation is disabled.

## Actors

- Customer: completes Stripe checkout or sunflower package checkout.
- API: handles the Stripe checkout session webhook in
  `apps/api/lib/stripe/processCheckoutSession.ts`.
- Storage: creates transactions, invoices, receipts, email logs, and sunflower
  ledger entries.
- Admin: reconciles failed or skipped billing states in `apps/app`.
- Fiscalization provider: confirms Croatian receipt fiscalization.
- Email provider: sends `commerce-billing-documents` and records delivery state.

## Configuration

Unset, blank, `false`, `off`, `0`, and unknown values are disabled. Accepted
enabled values are `1`, `true`, `yes`, `on`, and `enabled`.

Enable automation only on the API project:

```bash
GREDICE_BILLING_AUTOMATION_ENABLED=true
```

Disable or roll back with:

```bash
GREDICE_BILLING_AUTOMATION_ENABLED=false
```

The parser lives in `apps/api/lib/billing/automationFlag.ts`. Keep production
disabled until the launch checklist in `docs/sunflower-billing-rollout.md` is
green.

## Entry Points

- Checkout webhook: `apps/api/lib/stripe/processCheckoutSession.ts`.
- Invoice creation: `ensureInvoiceForTransaction` in
  `packages/storage/src/repositories/invoicesRepo.ts`.
- Receipt issuing and fiscalization:
  `packages/fiscalization/src/server.ts`.
- Billing document email:
  `apps/api/lib/billing/billingDocumentEmail.ts`.
- Admin reconciliation: `/admin/billing/reconciliation`.
- Manual previews: `/admin/billing/previews`.

## State Model

- Transaction: Stripe payment captured and stored with `status = completed`.
- Invoice: generated for a completed transaction and marked `paid`.
- Receipt: generated from a paid invoice.
- Fiscalization: receipt `cisStatus` moves through `pending`, `failed`, or
  `confirmed`.
- Billing email: `commerce-billing-documents` log uses
  `metadata.billingDeliveryKey = billing-documents:invoice:{invoiceId}`.

## Happy Path

1. Stripe checkout completes.
2. API creates or reuses a completed transaction.
3. If automation is enabled, API generates a paid invoice from trusted checkout
   line items and billing snapshot.
4. API issues a receipt for the paid invoice.
5. API fiscalizes the receipt.
6. API sends the billing document email with invoice and, when fiscalized,
   receipt links.
7. API sends the order confirmation email for the purchased items.

## Recovery

Use `/admin/billing/reconciliation` first. It lists bounded, newest-first rows
and links to the existing manual recovery page for each issue:

- Completed transactions without invoices: open the transaction and use
  `Generiraj ponudu`.
- Paid invoices without receipts: open the invoice and use `Stvori račun`.
- Receipts with `pending` or `failed` fiscalization: open the receipt and use
  `Fiskaliziraj račun`.
- Missing or failed billing document emails: open the invoice and email log,
  then retry through the delivery path after the underlying failure is fixed.

The page is backed by
`packages/storage/src/repositories/billingReconciliationRepo.ts`, so support
queries and admin UI use the same state rules.

## Rollout

1. Keep `GREDICE_BILLING_AUTOMATION_ENABLED=false`.
2. Open `/admin/billing/reconciliation` and clear any pre-existing production
   rows that would hide launch regressions.
3. Run a preview checkout and confirm transaction, invoice, receipt,
   fiscalization, billing email, and order confirmation behavior.
4. Enable the flag on the API project.
5. Complete one low-risk production checkout.
6. Re-open `/admin/billing/reconciliation` and confirm no new rows remain.
7. Monitor API logs for `Checkout invoice generation skipped`,
   `Checkout receipt issuing skipped`, `Checkout receipt fiscalization failed`,
   and `Checkout billing document automation failed`.

## Rollback

Set `GREDICE_BILLING_AUTOMATION_ENABLED=false` on the API project. Existing
manual admin workflows continue to work, and checkout processing continues
without automatic document mutations. Reconcile any captured payments through
the admin reconciliation page before re-enabling.

## Validation

Run the narrowest relevant checks from the repo root:

```bash
pnpm --filter api test:node processCheckoutSession.node.spec.ts
pnpm --filter @gredice/storage test:node billingReconciliationRepo.node.spec.ts
pnpm --filter app build
pnpm --filter app lint
pnpm --filter @gredice/storage lint
git diff --check
```
