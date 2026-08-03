# Gredice Garden for Android

This project packages the existing Garden PWA at <https://vrt.gredice.com> as a Trusted Web Activity (TWA). It was imported from `gredice/gredice-twa` at commit `e7ee639f9f46904c509f534f0b22c81d5107dcf7` so the web app, Android wrapper, release automation, and store material can evolve in one repository.

The Play application ID remains `com.gredice.vrt.twa`. Do not change it or replace the established upload/app-signing keys: both are part of the identity of the app already published on Google Play.

## Requirements

- JDK 17
- Android SDK Platform 36 and Build Tools 36.0.0
- The checked-in Gradle wrapper (Gradle 9.5.1)

Android Browser Helper is pinned to `2.7.2`. `twa-manifest.json` remains the Bubblewrap source description, while the Gradle and Android source files are reviewed and maintained in this repository.

## Local verification

From this directory:

```bash
./gradlew --no-daemon lintRelease testDebugUnitTest assembleDebug bundleRelease
```

Or from the monorepo root:

```bash
pnpm --filter @gredice/garden-android android:verify
```

Without signing environment variables, `bundleRelease` produces an unsigned AAB suitable for CI validation. Build products are written below `app/build/` and are not committed.

## Signed release bundle

The protected GitHub release workflow supplies these environment variables:

- `ANDROID_UPLOAD_KEYSTORE_PATH`
- `ANDROID_UPLOAD_STORE_PASSWORD`
- `ANDROID_UPLOAD_KEY_ALIAS`
- `ANDROID_UPLOAD_KEY_PASSWORD`

The keystore and passwords must stay in GitHub environment secrets. Never commit or upload them as ordinary workflow artifacts. See [`store/README.md`](store/README.md) for the Play listing handoff.

## Web association

The TWA opens without browser chrome only when `https://vrt.gredice.com/.well-known/assetlinks.json` contains the SHA-256 certificate fingerprint used to sign the installed build. The production Play fingerprint is maintained in `apps/garden/public/.well-known/assetlinks.json`; verify that relationship before promoting each release.
