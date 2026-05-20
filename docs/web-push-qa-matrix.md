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

## 3. Automated test harness (repository)

Primary automated checks should cover:

1. **API contracts**: payload and channel-policy shape validation for notification enqueue/send endpoints.
2. **Preference filtering**: `required`, quiet hours, digest routing, channel overrides.
3. **Delivery router behavior**: push suppressed with no subscription, push queued with active subscription, idempotent queueing.
4. **Retention/revocation cleanup**: denied/default stale subscriptions disabled; old events/attempts cleaned safely.
5. **Service worker payload handling**: unit tests for `showNotification`, click/action routing, and fallback behavior when optional fields are absent.

Current repository coverage anchors in `packages/storage/tests/notificationsRepo.node.spec.ts` and should be expanded as push-specific codepaths land.

## 4. Manual QA script (local + preview)

> Goal: run real push validation without exposing private VAPID keys in git history or screenshots.

### Setup

1. Configure VAPID secrets through environment variables in local shell or hosting secret manager only.
2. Start API/app with HTTPS-capable local origin where service workers can register.
3. Register at least two test users and two devices/browsers per user.

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

## 5. Release checklist additions

Before shipping push changes:

- [ ] Confirm browser/device matrix still matches current target versions.
- [ ] Validate iOS/iPadOS Home Screen caveat in release notes and QA sign-off.
- [ ] Confirm denied/default/revoked subscription cleanup behavior via automated tests.
- [ ] Validate quiet-hours and digest routing for non-required notifications.
- [ ] Run one preview-environment smoke test with real subscriptions and audited logs.

## References

- MDN Notifications API and Push API compatibility guidance.
- WebKit: Web Push for Web Apps on iOS and iPadOS (16.4+ Home Screen support).
