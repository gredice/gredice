# Outlet workflow

## Summary

Outlet sells discounted leftover greenhouse seedlings as limited-time, limited-stock offers. The storage model is the source of truth for offer publication, held cart stock, paid conversion, and lifecycle cleanup. Public visitors can browse active offers on `apps/www`, customers can reserve an offer from the garden game, admins manage offers in `apps/app`, and Stripe checkout converts a held reservation into a greenhouse-grown raised-bed plant.

## Actors

- Public visitor: browses `/outlet` and landing-page outlet highlights.
- Customer: opens the game Outlet panel, selects a raised-bed field, adds an outlet seedling to cart, and checks out.
- Internal admin: creates, edits, publishes, pauses, closes, and audits offers at `/admin/outlet`.
- System cron: releases expired holds and closes expired published offers.
- Stripe webhook: validates paid cart metadata and converts the held reservation.

## Configuration

- `CRON_SECRET` protects `GET /api/internal/cron/outlet-lifecycle`.
- Existing Stripe, auth, database, and PostHog configuration apply through checkout and webhook code.
- Outlet offer images are stored as public URLs in the offer row; no new upload bucket is introduced.

## Entry points

- Storage: `packages/storage/src/schema/outletSchema.ts` and `packages/storage/src/repositories/outletOffersRepo.ts`.
- Public API: `apps/api/app/api/[...route]/outletRoutes.ts`.
- Cart reservation: `apps/api/app/api/[...route]/shoppingCartRoutes.ts`.
- Checkout validation: `apps/api/app/api/[...route]/checkoutRoutes.ts` and `apps/api/lib/checkout/cartInfo.ts`.
- Payment conversion: `apps/api/lib/stripe/processCheckoutSession.ts`.
- Lifecycle cron: `apps/api/app/api/internal/cron/outlet-lifecycle/route.ts` and `apps/api/vercel.json`.
- Public site: `apps/www/app/outlet` and `apps/www/app/outlet/OutletLandingSection.tsx`.
- Garden game: `packages/game/src/hud/OutletHud.tsx`, `packages/game/src/hooks/useOutletOffers.ts`, and raised-bed plant picker/cart components.
- Admin: `apps/app/app/admin/outlet`.

## State model

Offer states:

- `draft`: editable admin-only offer.
- `published`: eligible for public listing when `startAt <= now < endAt` and remaining quantity is positive.
- `paused`: hidden from public listing without deleting operational history.
- `closed`: terminal state for ended or manually closed offers.

Reservation states:

- `held`: stock is reserved for a cart item until `holdExpiresAt`.
- `released`: stock is returned because the cart item was removed, checkout was canceled, or the hold expired.
- `converted`: payment succeeded and the held reservation was used to create the raised-bed plant.

Price, sowing date, and initial plant status are copied from the offer into the reservation when the hold is created. Later offer edits do not change the paid conversion snapshot.

## Happy path

1. Admin creates an offer with plant sort, sowing date, image URLs, outlet price, optional compare price, quantity, start/end time, and status.
2. A published active offer appears on `/outlet`, the landing-page section, and the garden Outlet panel.
3. The customer chooses a raised-bed field and adds the outlet seedling to cart.
4. The API locks the offer row, checks active held plus converted quantity, and creates or refreshes the cart reservation.
5. Checkout refreshes valid outlet holds before creating the Stripe session and writes outlet metadata onto Stripe products.
6. The webhook validates metadata against the cart item reservation, converts the reservation idempotently, and creates the raised-bed plant with `sowingLocation: greenhouse`.
7. Garden raised-bed state uses the outlet sowing date as the effective event date, so the plant age matches the real greenhouse seedling.

## Failure handling

- Sold-out, unpublished, not-started, expired, and mismatched plant-sort offers return conflict errors during cart mutation.
- Expired or ended outlet holds add cart notes and block checkout.
- Checkout cancellation releases held outlet reservations for the affected carts.
- Stripe webhook conversion is idempotent: a converted reservation can be processed again without consuming more stock.
- Stripe metadata is validated against the stored reservation before planting.
- The cron route is retry-safe and treats empty work as a successful no-op.

## Observability

- Outlet lifecycle cron returns released reservation and closed offer counts.
- Payment conversion emits a PostHog `outlet_reservation_converted` event.
- Checkout and webhook failures use existing API logging paths and should avoid logging private payment payloads or secrets.

## Validation

Run focused checks from the repo root:

```bash
pnpm --filter @gredice/storage test:node outletOffersRepo.node.spec.ts gardensRepo.raisedBedFields.node.spec.ts cmsPagesRepo.node.spec.ts
pnpm --filter api test:node
pnpm --filter app test:unit
pnpm --filter www test:cms-pages
pnpm --filter @gredice/game test
pnpm --filter @gredice/storage lint
pnpm --filter api lint
pnpm --filter app lint
pnpm --filter www lint
pnpm --filter @gredice/game lint
pnpm --filter @gredice/game typecheck
pnpm --filter www typecheck
pnpm --filter api build
pnpm --filter app build
pnpm --filter www build
```

Manual smoke checks before release:

- Create a draft offer in `/admin/outlet`, publish it, pause it, republish it, then close it.
- Confirm active offers show on `/outlet`, on the landing page, and in the garden Outlet panel.
- Add an outlet seedling to cart from a raised-bed field and verify stock remaining, cart price, hold expiry, and checkout eligibility.
- Complete checkout in a test Stripe flow and confirm the reservation becomes converted and the raised-bed plant appears as greenhouse-grown.
- Let or force a hold expire, run the outlet lifecycle cron with `CRON_SECRET`, and verify stock is returned.
