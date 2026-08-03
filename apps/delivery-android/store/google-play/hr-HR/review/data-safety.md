# Data safety notes for fixture build 1

- No ads.
- No telemetry or crash-reporting SDK is included in the native fixture.
- No native location permission is requested.
- The two stops are static public-place fixtures; no customer or order data is bundled.
- Selecting a stop sends only its coordinates to the driver's chosen navigation app through an implicit system intent.
- The phone launcher opens `https://dostava.gredice.com`, whose authenticated web behavior and data disclosures remain governed by the Gredice privacy policy.

Reassess every answer before replacing the fixture repository with authentication, route projection, cache, or telemetry.
