# Gredice Delivery for Android

This is a thin native shell around the existing Delivery web app. The phone launcher opens <https://dostava.gredice.com>; the native code exists only where Android Auto requires it.

The car app declares the `POI` category, reads the bounded active-route projection, renders it with `PlaceListMapTemplate`, and hands a selected stop to the driver's default navigation app with an implicit `androidx.car.app.action.NAVIGATE` intent and a `geo:lat,lng` URI.

It intentionally does **not** provide turn-by-turn navigation, request native location permission, target Google Maps by package name, display customer notes/order contents, or mutate delivery state.

## Requirements and verification

- JDK 17
- Android SDK Platform 36 and Build Tools 36.0.0
- The checked-in Gradle wrapper (Gradle 9.5.1)

From the monorepo root:

```bash
pnpm --filter @gredice/delivery-android android:verify
```

To exercise the car UI, install `app/build/outputs/apk/debug/app-debug.apk`, enable Android Auto developer mode, start the Desktop Head Unit, and open **Gredice Dostava**. A real DHU/device capture is a release gate; generated UI mockups are not accepted as Store screenshots.

The complete packaging, signing, Digital Asset Links, Play-track, and recovery procedure is in [`docs/android-play-release.md`](../../docs/android-play-release.md).

## Web trust and authentication

The Play-delivered phone surface is associated with `https://dostava.gredice.com` through the Play app-signing certificate in `apps/delivery/public/.well-known/assetlinks.json`. `node scripts/validate-delivery-car-contract.mjs` keeps that association aligned with the Android package and verified host. Directly installed debug or upload-key-signed builds are not Play-association evidence and may use the Custom Tab fallback.

The manifest must keep Android Browser Helper's `ManageDataLauncherActivity` declaration and `manageSpaceActivity` application attribute. The launcher registers the browser site-settings shortcut during startup; omitting that component causes an immediate native crash before the web surface opens.

The launcher is a small native pairing/logout shell; the operational phone UI remains the Delivery TWA. Pairing uses the system browser, the fixed `gredice-delivery-android` public client, S256 PKCE, and the exact verified callback `/android/auth/callback`. The rotating refresh credential and one bounded active-route snapshot are persisted with separate Android Keystore AES-GCM keys and excluded from backup. Access credentials remain process memory only. The route snapshot is usable offline for at most two minutes; stale, invalid, signed-out, revoked, and confirmed no-route states cannot expose cached navigation actions.

A navigation tap persists only a backup-excluded process-recovery marker containing the local session binding, route/revision, opaque navigation ID, kind, and launch time. It never persists the destination coordinates, address, label, token, or customer data. The marker is removed after a failed handoff, logout, account change, missing run, or route revision change. Missing handlers and host/security failures show one provider-neutral Croatian message and leave the route screen usable.

Immediately before a navigator handoff, the app posts or updates one low-importance `Gredice Dostava` notification on the `active-delivery-route` channel. Its copy contains no stop, destination, account, or route data; process recovery stores only an active flag and one-way session/route fingerprints. Android Auto controls where this return shortcut appears. Tapping it opens the root car screen and triggers an immediate server refresh; logout, revocation, account/route replacement, and confirmed no-active-route states cancel it. Android 13+ users can grant notification access from the paired phone shell. Notification denial or posting failure never blocks the navigator.

The car display fails closed with **Prijavite se u aplikaciji na telefonu** when no native session is available. Route refresh is serialized across the process, revalidates with an ETag every 30 seconds only while the car screen is resumed, and is cancelled when the screen stops. Returning from the selected navigator triggers start/resume refresh and trusts the server-selected current stop; no navigator result, elapsed-time, proximity, or completion inference is used. One failed authenticated API request is retried after credential rotation, and a second `401` clears the local session and route cache.

The server surface is guarded by `DELIVERY_ANDROID_AUTO_ENABLED`. An absent or non-`true` value disables native token exchange, refresh, and active-route reads with the stable `ANDROID_AUTO_DISABLED` code while keeping session revocation available. The Android client immediately clears cached stops and navigation/quick-return state, then directs the driver back to the phone Delivery app; it never treats the kill switch as an offline-cache condition.

## Integration seam

`DeliveryStopRepository` remains the boundary between the car-safe UI and route data. Keep customer notes, phone numbers, full order contents, background GPS, and delivery mutations outside this surface.
