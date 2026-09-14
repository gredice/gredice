# Android Google Play release runbook

This runbook covers the two Android projects in this repository:

| App | Project | Application ID | Play path |
| --- | --- | --- | --- |
| Garden TWA | `apps/garden-android` | `com.gredice.vrt.twa` | Existing listing; internal test before production |
| Delivery phone and Android Auto shell | `apps/delivery-android` | `com.gredice.dostava` | Internal test, then the POI feasibility closed test |

The repository packages a signed Google Play handoff. It does **not** upload a
bundle to Play Console, create a Play release, promote a track, or change a
rollout percentage. Those remain manual Play Console actions.

## Signing identities

[Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)
uses two different identities. Do not substitute one for the other.

- The **upload key** is held by Gredice and signs the AAB sent to Play. Play
  checks it to authorize the upload. The protected GitHub environment supplies
  this key to the release workflow.
- The **Play app-signing key** is held by Google Play and signs the APKs that
  Play delivers to devices. Its public SHA-256 certificate fingerprint is the
  one used for Digital Asset Links, Trusted Web Activity trust, App Links, and
  any API provider that authenticates the installed Play build.

The APK packaged by the GitHub release workflow is signed with the upload key.
It is useful for controlled diagnostics, but it is not byte-for-byte or
certificate-equivalent to an APK delivered by Play. Verify TWA and App Links
using an install from a Play test track, not by sideloading that APK.

Keep the two apps isolated. GitHub uses the same configuration names in two
different protected environments, `Google Play - garden` and
`Google Play - delivery`, so each environment can hold its own upload key.

### Protected environment configuration

Each protected environment must contain these GitHub Actions **secrets**:

- `ANDROID_UPLOAD_KEYSTORE_BASE64`
- `ANDROID_UPLOAD_KEY_ALIAS`
- `ANDROID_UPLOAD_KEY_PASSWORD`
- `ANDROID_UPLOAD_STORE_PASSWORD`

It must also contain this GitHub Actions **variable**:

- `ANDROID_UPLOAD_CERT_SHA256`

`ANDROID_UPLOAD_CERT_SHA256` is the upload certificate fingerprint, not the
Play app-signing certificate fingerprint. The workflow decodes the keystore to
an ephemeral runner path, calculates the selected alias's certificate
fingerprint with `keytool`, and stops before building if it differs from the
configured variable.

Never commit a keystore, private key, password, base64 keystore value, or a
local secrets file. Do not paste those values into issues, pull requests,
release notes, logs, or ordinary Actions artifacts. Configure them through the
GitHub environment settings and transfer backups through the approved secret
store only.

## Version a release

The release workflow reads the source-controlled version from the selected
project's `gradle.properties`:

```properties
GREDICE_VERSION_CODE=<positive integer>
GREDICE_VERSION_NAME=<semantic version>
```

For every candidate:

1. Check Play Console for the greatest version code already accepted for that
   application ID, including inactive and test-track artifacts, and choose a
   greater integer. Do not assume that halting or rolling back a release frees
   its version code for reuse.
2. Update both values in `apps/<app>-android/gradle.properties`.
3. For Garden, mirror the same values in
   `apps/garden-android/twa-manifest.json` as `appVersionCode` and
   `appVersion`. The Garden contract validator enforces this relationship.
4. Add or update the Croatian Play release notes under
   `apps/<app>-android/store/google-play/hr-HR/release-notes/`. Use the version
   code as the file name so the handoff is unambiguous.
5. Do not infer the Android release version from `package.json`; the release
   workflow does not read it.

Run the app's pull-request checks before merging:

```bash
pnpm --filter @gredice/garden-android android:verify
pnpm --filter @gredice/garden-android contract:validate
pnpm --filter @gredice/garden-android store:validate

pnpm --filter @gredice/delivery-android android:verify
pnpm --filter @gredice/delivery-android contract:validate
pnpm --filter @gredice/delivery-android store:validate
```

Pull-request CI builds an unsigned release AAB and a debug APK, retained for
seven days in `garden-android-unsigned-<commit>` or
`delivery-android-unsigned-<commit>`. These prove that the project builds; they
are not Play upload candidates.

Delivery's CI currently allows its genuine Store screenshots to remain pending.
The protected release workflow requires at least two real screenshots for its
default `full-handoff` target. The narrowly scoped `internal-test` target may
omit them only for a Delivery candidate that will be installed from Play to
capture and validate the exact phone and Desktop Head Unit surfaces. An
`internal-test` handoff is not eligible for a closed test or production. Follow
`apps/delivery-android/store/google-play/hr-HR/graphics/screenshots/README.md`,
commit the genuine captures, and use a greater version code for the subsequent
full handoff.

## Package the Play handoff

Merge the candidate to `main`, then dispatch **Release - Android** for either
`garden` or `delivery`. The job is intentionally skipped on every ref except
`main`.

From GitHub CLI, the equivalent dispatch is:

```bash
gh workflow run android-release.yml \
  --ref main \
  -f app=garden \
  -f createGithubRelease=true \
  -f releaseTarget=full-handoff
```

Replace `garden` with `delivery` when packaging Delivery. The boolean input
controls whether the workflow also creates or updates a draft GitHub release;
it does not publish anything to Google Play.

For Delivery's first internal-only candidate while genuine captures are still
pending, dispatch the guarded target explicitly:

```bash
gh workflow run android-release.yml \
  --ref main \
  -f app=delivery \
  -f createGithubRelease=true \
  -f releaseTarget=internal-test
```

Do not upload an `internal-test` handoff to a closed or production track.

The workflow:

1. Validates the version, Croatian Store bundle, Gradle wrappers, and the
   app-specific Garden TWA or Delivery car contract. A `full-handoff` requires
   the complete Store bundle with genuine screenshots; only Delivery's guarded
   `internal-test` target permits the screenshots to remain pending.
2. Verifies the upload certificate fingerprint against the protected
   environment variable.
3. Runs `lintRelease`, `testDebugUnitTest`, `bundleRelease`, and
   `assembleRelease` with JDK 17, Android Platform 36, and Build Tools 36.0.0.
4. Verifies the AAB with `jarsigner` and the APK with `apksigner`.
5. Produces build provenance attestations for the signed AAB and APK.
6. Uploads the handoff as an Actions artifact retained for 30 days and,
   optionally, as assets on a draft GitHub release tagged
   `android-<app>-v<versionName>` for a full handoff or
   `android-delivery-v<versionName>-internal-test` for Delivery's internal-only
   candidate.

The artifact prefix is
`gredice-<app>-android-<versionName>-<versionCode>`. Delivery's internal-only
candidate appends `-internal-test` so its artifact and draft release cannot be
mistaken for a closed or production handoff. The handoff contains:

- `<prefix>.aab` — the signed bundle to upload to Play Console;
- `<prefix>.apk` — an upload-key-signed diagnostic APK, not the Play-delivered
  APK;
- `<prefix>-mapping.txt` — R8 mapping output when generated;
- `<prefix>-store-assets.zip` — the reviewed `store/google-play/hr-HR` tree;
- `<prefix>-build-metadata.txt` — app, version, commit, SDK, Build Tools, and
  Java metadata;
- `SHA256SUMS` — checksums for every staged handoff file.

After download, verify the handoff before using it:

```bash
sha256sum --check SHA256SUMS
gh attestation verify ./gredice-*-android-*.aab --repo gredice/gredice
gh attestation verify ./gredice-*-android-*.apk --repo gredice/gredice
```

Keep the draft GitHub release until the Play handoff is accepted. The 30-day
Actions artifact expiry does not remove assets attached to a GitHub release.

## Digital Asset Links

Both Android manifests declare an HTTPS host with `android:autoVerify="true"`.
The host must serve a matching statement at
`https://<host>/.well-known/assetlinks.json`. The fingerprint must come from
the **Play app-signing key certificate** shown in Play Console's app-integrity
page.

### Garden

Garden's current association is source controlled in:

- `apps/garden-android/twa-manifest.json`, under the fingerprint named
  `Google Play app signing`;
- `apps/garden/public/.well-known/assetlinks.json`, for package
  `com.gredice.vrt.twa`.

For an ordinary Garden release, compare those values with Play Console and do
not change them when only the upload key changes. If the app-signing
certificate really changes, publish the replacement association before
promoting the build and run:

```bash
node scripts/validate-garden-twa-contract.mjs
```

### Delivery

Delivery's Play association is source controlled in
`apps/delivery/public/.well-known/assetlinks.json` for package
`com.gredice.dostava`. The Delivery contract validator and Android CI path
coverage enforce the package, host, relation, and current Play app-signing
fingerprint.

For an ordinary Delivery release, compare the source-controlled fingerprint
with Play Console's **app-signing key certificate**, not the upload certificate,
and run:

```bash
node scripts/validate-delivery-car-contract.mjs
```

After deploying a changed association, confirm
`https://dostava.gredice.com/.well-known/assetlinks.json` returns the JSON
directly over HTTPS with a successful response before treating the relationship
as live. Directly installed debug or upload-key-signed builds may use the Custom
Tab fallback and do not prove the Play-delivered association.

For either host, the
[Digital Asset Links API](https://developer.android.com/training/app-links/test-applinks#confirm-digital-assets-links-files)
can confirm the deployed statement. On an Android 12 or newer test device,
reset and request verification, wait for the verifier, then inspect the result:

```bash
adb shell pm set-app-links --package com.gredice.vrt.twa 0 all
adb shell pm verify-app-links --re-verify com.gredice.vrt.twa
adb shell pm get-app-links com.gredice.vrt.twa
```

Use `com.gredice.dostava` instead when verifying Delivery.

The host must report `verified`. This is useful App Links evidence, but Garden
must also be opened from a Play-installed build to prove the browser grants
fullscreen TWA trust. Delivery must open its phone web surface without the
Custom Tab fallback before its web association is considered complete.

## Play test and rollout

### Delivery server kill switch

`DELIVERY_ANDROID_AUTO_ENABLED` guards the Delivery native token and route
surface in the API project. It is fail-closed: an absent value, `false`, or any
value other than `true` returns `ANDROID_AUTO_DISABLED` before issuing or
rotating credentials and before reading driver route data. Native session
revocation remains available so a driver can always disconnect the device.

Before enabling a Play test, configure the API deployment environment with
`DELIVERY_ANDROID_AUTO_ENABLED=true` and verify the exact deployment. To stop
the car surface, set it to `false`, redeploy the API, and verify token exchange,
token refresh, and `GET /api/delivery/mobile/v1/active-route` return `503` with
the stable code. Confirm the car clears any cached stops and shows the phone-app
fallback, while logout still removes the local and server session family.

Do not treat changing the environment value as live evidence until the API
deployment containing that value is ready and the endpoints have been read
back. Keep the flag disabled in new environments until their auth, privacy,
and synthetic-route checks are complete.

Only upload `<prefix>.aab`; do not upload the diagnostic APK. Reconcile the
text and graphics in `<prefix>-store-assets.zip` manually with the target Play
listing, including Data safety and app-access answers.

### Garden: internal test before production

1. Upload the AAB to Garden's internal test track and use the matching Croatian
   release notes.
2. Install the build through the tester opt-in link so Play signs and delivers
   it. Confirm application ID, version code, and version name on the device.
3. Verify authenticated Garden startup, fullscreen TWA presentation without
   browser chrome, web navigation, notification behavior, and return from
   background.
4. Confirm the deployed Digital Asset Links statement and the app-link result
   above.
5. Resolve Play pre-launch report findings and recheck Data safety before
   promoting the tested artifact to a staged production rollout. Monitor the
   rollout before increasing its percentage.

### Delivery: internal test, then POI closed test

1. Complete the genuine phone and Desktop Head Unit screenshots. Generated car
   UI images are not release evidence.
2. Upload the AAB to an internal test first. Install it through Play, verify the
   phone web association, and exercise the exact candidate with Android Auto's
   [Desktop Head Unit](https://developer.android.com/training/cars/testing/dhu).
3. Confirm the current feasibility scope: the `POI` category appears, the two
   synthetic public-place stops render, and **Navigacija** hands the selected
   coordinates to an available default navigation provider. Confirm the app
   does not claim turn-by-turn navigation or expose real customer data.
4. After capturing and committing the evidence, increment the version code and
   package a newer `full-handoff` candidate. Upload only that newer candidate to
   the designated closed track, supply the checked-in app-access and Data safety
   review notes, and submit it for the Android Auto POI/category review.
5. Keep production and real-route integration blocked until the category is
   accepted and the separate authentication, route-projection, physical-car,
   and privacy gates are complete.

Google recommends internal testing before a wider closed test; see the official
[Play testing tracks guide](https://support.google.com/googleplay/android-developer/answer/9845334).

## Recovery and rotation

### Lost or compromised upload key

1. Stop release dispatches for the affected application ID and audit access to
   the protected environment. Do not replace the repository package ID or the
   Play app-signing fingerprint.
2. Confirm in Play Console that the app is enrolled in Play App Signing. Create
   a replacement upload key through the approved offline process and request an
   **upload key reset** for the exact app in Play Console.
3. Wait until Play reports the replacement upload certificate as active.
4. Replace the four environment secrets and the
   `ANDROID_UPLOAD_CERT_SHA256` variable in only the affected app's protected
   GitHub environment.
5. Dispatch a new workflow run and upload a newly packaged AAB. Never reuse an
   AAB signed with the old or wrong upload key.

Changing only the upload key does not change the certificate on Play-delivered
installs, so it does not require a Digital Asset Links change. If the app is not
enrolled in Play App Signing, stop and escalate: replacing a lost signing key
can make updates to the existing application ID impossible.

### Play app-signing key upgrade

Treat an app-signing key upgrade as a separate migration, not a routine release.
Follow Play Console's supported key-upgrade flow and determine which certificate
Play will use for each supported Android version. Before rollout, add every
still-active Play app-signing SHA-256 fingerprint to Digital Asset Links and to
any certificate-bound API provider. Keep the old association during the
transition; removing it early can break trusted launches for existing installs.
Then validate a Play-delivered build on both the old-key and new-key device
paths before promotion.

### Bad binary, listing, or association

- Halt a staged rollout in Play Console. Fix the source and publish a new build
  with a greater version code; version codes cannot be rolled back or reused.
- If only Store text or graphics are wrong, correct them in the repository and
  Play Console, then regenerate the handoff so its archived assets match Play.
- If Digital Asset Links is wrong, restore all valid Play app-signing
  fingerprints, deploy the website independently, rerun the API/device checks,
  and retest a Play-installed build. Do not rotate an upload key to repair DAL.
