# Gredice Delivery for Android

This is a thin native shell around the existing Delivery web app. The phone launcher opens <https://dostava.gredice.com>; the native code exists only where Android Auto requires it.

The first car build is a Play closed-test feasibility slice. It declares the `POI` category, renders two synthetic public-place stops with `PlaceListMapTemplate`, and hands a selected stop to the driver's default navigation app with an implicit `androidx.car.app.action.NAVIGATE` intent and a `geo:lat,lng` URI.

It intentionally does **not** provide turn-by-turn navigation, request native location permission, target Google Maps by package name, display real customer data, or mutate delivery state.

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

The synthetic car fixture avoids authentication only for the category-feasibility review. Replacing it with the real route projection is tracked separately and must fail closed when the driver's session is unavailable.

## Next integration seam

`DeliveryStopRepository` is the boundary between the car-safe UI and route data. Replace `FixtureDeliveryStopRepository` only after the native authentication and minimal route-projection contracts are available. Keep customer notes, phone numbers, full order contents, background GPS, and delivery mutations outside this surface.
