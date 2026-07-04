# Web Push QA matrix and test harness

This QA plan defines what we verify for Web Push behavior across supported clients, which capabilities are expected to work, and how to run safe automated/manual checks in local and preview environments.

## 1. Browser/device support matrix

Source notes for platform behavior are based on MDN API compatibility docs and WebKit announcements for iOS/iPadOS Home Screen Web Push.

| Platform | App context | Push receive | Rich image (`image`) | Action buttons (`actions`) | Click/open deep-link | Notes |
|---|---|---|---|---|---|---|
| Chrome (desktop, latest stable) | Browser tab + service worker | ✅ | ✅ | ✅ | ✅ | Baseline implementation target. |
| Edge (desktop, latest stable) | Browser tab + service worker | ✅ | ✅ | ✅ | ✅ | Chromium behavior should follow Chrome for payload support. |
| Firefox (desktop, latest stable) | Browser tab + service worker | ✅ | ⚠️ partial | ⚠️ partial | ✅ | Rich media/action UI differs by OS shell. Validate presence and graceful fallback. |
| Safari macOS 16.1+ | Browser tab + service worker | ✅ | ⚠️ partial | ⚠️ partial | ✅ | Web Push supported on macOS Safari; validate payload fallback. |
| iOS/iPadOS Safari 16.4+ | Home Screen web app only | ✅ | ⚠️ partial | ⚠️ partial | ✅ | Requires Add to Home Screen and user gesture for permission prompt. |
| iOS/iPadOS in-browser tab | Safari/other browser tab | ❌ | n/a | n/a | n/a | No full Web Push flow unless installed to Home Screen app mode. |

Legend: ✅ supported, ⚠️ supported with caveats/OS UX variance, ❌ unsupported.

## 2. Permission-state matrix

Track each account/device through these states and expected routing behavior:

| State | Expected subscription status | Router outcome for push | QA assertion |
|---|---|---|---|
| `unsupported` | No Push API capability | `suppressed` | Push channel not queued; fallback channels still evaluated. |
| `default` | Browser prompt not decided | `suppressed` until explicit grant | No active subscription should be used. |
| `granted` | Active valid subscription | `immediate` / queued | Push delivery attempt queued for enabled subscription(s). |
| `denied` | Permission denied | `suppressed` | Subscription considered non-deliverable; no retry spam. |
| `subscribed` | App-level active endpoint | queued | Idempotent queueing per `(notificationId, subscriptionId)`. |
| `disabled` | App setting off | `suppressed` | Preference filtering suppresses push despite grant. |
| `revoked` | `revokedAt` set | `suppressed` | Revoked subscriptions excluded from queueing. |
| `expired` | Endpoint rejected by provider | failure then disable/revoke path | Failure counters/retention cleanup disable stale endpoint. |

## 3. Configuration

Use checked-in examples for names only. Keep real VAPID private keys in local
`.env` files, Vercel environment variables, or the hosting secret manager.

| App | Variable | Purpose |
|---|---|---|
| `apps/api` | `GREDICE_WEB_PUSH_VAPID_SUBJECT` | VAPID contact subject, for example `mailto:dev@gredice.com`. |
| `apps/api` | `GREDICE_WEB_PUSH_VAPID_PUBLIC_KEY` | Public VAPID key used by the API sender. Must match the public client keys. |
| `apps/api` | `GREDICE_WEB_PUSH_VAPID_PRIVATE_KEY` | Private VAPID key used only by the API sender. Never expose as `NEXT_PUBLIC_*`. |
| `apps/api` | `CRON_SECRET` | Protects the internal queued Web Push cron route. |
| `apps/garden` | `NEXT_PUBLIC_GREDICE_WEB_PUSH_VAPID_PUBLIC_KEY` | Browser subscription key compiled into the Garden client. |
| `apps/farm` | `NEXT_PUBLIC_GREDICE_WEB_PUSH_VAPID_PUBLIC_KEY` | Browser subscription key compiled into the Farm client settings flow. |

The same names are allowlisted in `apps/api/turbo.json`,
`apps/garden/turbo.json`, and `apps/farm/turbo.json`, and safe placeholders
live in `apps/api/.env.example`, `apps/garden/.env.example`, and
`apps/farm/.env.example`.

## 4. Automated test harness (repository)

Current automated coverage anchors:

| Area | Coverage | Command |
|---|---|---|
| API contracts and sender behavior | `apps/api/lib/notifications/pushDevices.node.spec.ts`, `pushEvents.node.spec.ts`, and `webPushSender.node.spec.ts` cover subscription payload validation, event metadata filtering, Web Push payload shape, retry handling, invalid endpoint revocation, and the test-notification helper. | `pnpm --filter api test:node` |
| Storage routing and preferences | `packages/storage/tests/notificationsRepo.node.spec.ts` covers preference filtering, quiet hours, digest routing, deliverable subscription filtering, idempotent push queueing, delivery events, and summaries. | `pnpm test --filter @gredice/storage` |
| Browser subscription helper | `packages/game/src/hooks/pushSubscription.unit.ts` covers subscription reuse, base64 key conversion, and registration payload persistence. | `pnpm --filter @gredice/game test` |
| Shared client browser subscription helper | `packages/client/tests/push.node.spec.ts` covers farm/app client subscription metadata, endpoint fallback, and subscription reuse. | `pnpm --filter @gredice/client test` |
| Garden service worker | `apps/garden/tests/push-notifications-sw.node.spec.mjs` covers fallback payloads, invalid JSON, same-origin URL/action normalization, click routing, and dismissal analytics payloads. | `pnpm --filter garden test:sw` |
| Garden settings UI | `apps/garden/tests/notifications-tab.spec.tsx` covers mocked preferences, devices, push status, loading/empty/error states, device lifecycle actions, and user-triggered test notification calls. | `pnpm test --filter garden` |
| Farm settings UI | `apps/farm/app/settings/_components/NotificationSettings.spec.tsx` covers mocked devices, push status, unsupported/denied/unconfigured/dismissed states, device toggle/revoke, and test notification calls. | `pnpm --filter farm exec playwright test app/settings/_components/NotificationSettings.spec.tsx` |

When a Garden dev server is already running for local debugging, run the Garden
package suite from `apps/garden` with:

```bash
GREDICE_PLAYWRIGHT_REUSE_SERVER=true pnpm run test
```

## 5. Manual QA script (local + preview)

> Goal: run real push validation without exposing private VAPID keys in git history or screenshots.

### Setup

1. Configure `GREDICE_WEB_PUSH_VAPID_SUBJECT`,
   `GREDICE_WEB_PUSH_VAPID_PUBLIC_KEY`, and
   `GREDICE_WEB_PUSH_VAPID_PRIVATE_KEY` for `apps/api`.
2. Configure the matching
   `NEXT_PUBLIC_GREDICE_WEB_PUSH_VAPID_PUBLIC_KEY` for `apps/garden` and
   `apps/farm`.
3. Start API/Garden/Farm with an HTTPS-capable local origin where service workers can
   register. The default `pnpm dev` proxy provides the `gredice.test` HTTPS
   domains when Docker and host entries are available.
4. Register at least two test users and two devices/browsers per user.

### Test flow

1. **Permission checks**
   - Verify unsupported/default/denied/granted transitions.
   - On iOS/iPadOS, verify Add-to-Home-Screen requirement explicitly.
2. **Subscription lifecycle**
   - Subscribe, disable in-app, re-enable, revoke, and simulate expired endpoint.
3. **Payload fidelity**
   - Send notifications with title/body only, with image, and with actions.
   - Verify graceful UI when rich fields are dropped by client.
4. **Interaction analytics**
   - Tap body click path and each action; verify deep-link and event logging.
5. **Policy behavior**
   - Verify quiet-hours deferral, digest routing, and bulk send fan-out behavior.

### Safety checks

- Never commit `.env` values or screenshots containing private keys.
- Use sample endpoints and rotating test credentials for demos.
- Treat real provider delivery, iOS/iPadOS Home Screen behavior, and OS-level
  notification UI rendering as manual/preview checks; the repository tests avoid
  real push provider credentials.

## 6. Release checklist additions

Before shipping push changes:

- [ ] Confirm browser/device matrix still matches current target versions.
- [ ] Validate iOS/iPadOS Home Screen caveat in release notes and QA sign-off.
- [ ] Run `pnpm --filter api test:node`,
      `pnpm test --filter @gredice/storage`,
      `pnpm --filter @gredice/game test`, and
      `pnpm test --filter garden`.
- [ ] Validate one preview-environment smoke test with real subscriptions,
      queued sender logs, and delivery audit events.
- [ ] Confirm screenshots or logs used for QA do not expose VAPID private keys,
      endpoints, auth cookies, or subscription key material.

## References

- MDN Notifications API and Push API compatibility guidance.
- WebKit: Web Push for Web Apps on iOS and iPadOS (16.4+ Home Screen support).
