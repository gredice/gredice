# Google Play listing handoff

`google-play/hr-HR` is the reviewed source bundle for the existing `com.gredice.vrt.twa` listing. Upload it manually together with the signed AAB produced by the protected Android release workflow.

Before production rollout:

1. Confirm that `GREDICE_VERSION_CODE` in `gradle.properties` is greater than every version code already uploaded to Play Console.
2. Confirm the Play app-signing fingerprint still matches `apps/garden/public/.well-known/assetlinks.json`.
3. Install from the Play internal track and verify that Garden opens as a fullscreen TWA, not a Custom Tab.
4. Review Data safety after the native location-delegation permission removal.
5. Check the four carried-forward phone screenshots against the current production UI and replace any outdated screen with a genuine capture.

The generated feature graphic is original Gredice artwork. The phone screenshots are the genuine assets served by the live Play listing on 2026-08-03; their source URLs and checksums are recorded in `google-play/hr-HR/review/asset-provenance.md`.

See [`docs/android-play-release.md`](../../../docs/android-play-release.md) for the signed handoff and track-promotion procedure.
