# Billing Automation

Billing document automation is guarded by `GREDICE_BILLING_AUTOMATION_ENABLED`.

## Default

Unset, blank, false, off, zero, and unknown values are treated as disabled. This
keeps local, preview, and production environments safe until invoice generation,
receipt issuing, fiscalization, and billing email delivery are ready.

## Enable

Set the server-side environment variable on the API project:

```bash
GREDICE_BILLING_AUTOMATION_ENABLED=true
```

Accepted enabled values are `1`, `true`, `yes`, `on`, and `enabled`.

## Disable

Remove the variable or set it to `false`:

```bash
GREDICE_BILLING_AUTOMATION_ENABLED=false
```

Manual admin preview and generation workflows are not blocked by this flag. The
flag is only for automatic checkout-driven invoice, receipt, fiscalization, and
billing email mutations.

## Verify

Before enabling production automation, verify the current state through the
central helper in `apps/api/lib/billing/automationFlag.ts` and keep rollout
checks documented on the Billing/Receipts rollout issues.
