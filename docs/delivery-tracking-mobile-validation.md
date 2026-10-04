# Delivery mobile tracking validation

This document defines the supported browser envelope for driver tracking in
`apps/delivery`, the physical-device validation protocol, and the decision gate
for a wrapped or native driver application.

## Product contract

- Server acknowledgement remains the source of truth. A local GPS callback or
  an active screen wake lock never makes tracking “live” by itself.
- A location is live for 30 seconds after server receipt, delayed through 120
  seconds, and unavailable as an exact customer-visible point after that TTL.
- The web app can request a **screen** wake lock only after the driver opts in
  for the current route. It releases the lock when the route is hidden, changed,
  completed, or unmounted, and when the driver opts out.
- A screen wake lock keeps a visible screen awake. It does not provide a system
  wake lock or reliable GPS callbacks after the page is hidden, another app is
  opened, or the device is explicitly locked.
- Drivers must keep the active route visible for the supported live-tracking
  promise. The UI says this before a delay occurs and continues to show the
  server-confirmed tracking age.

The lifecycle follows the [W3C Screen Wake Lock specification](https://www.w3.org/TR/screen-wake-lock/): only visible documents can acquire the screen lock, the user agent can release it, and an application must release its sentinel when it no longer needs it. Apple also warns that continuous web geolocation can reduce battery life in its [Safari Web Content Guide](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/GettingGeographicalLocations/GettingGeographicalLocations.html).

## Automated observed results

Observed on 2026-07-15 with Playwright 1.61.1 and its bundled desktop Chromium.
These checks validate application lifecycle behavior; they do not substitute
for physical iOS or Android evidence.

| Scenario | Observed result | Automated coverage |
| --- | --- | --- |
| Route opens without consent | No wake-lock request; proactive foreground guidance is visible | `route-continuity.spec.tsx` |
| Driver opts in and out | One request after opt-in; sentinel releases after opt-out | `route-continuity.spec.tsx` |
| Document becomes hidden, then visible | Sentinel releases while hidden and is reacquired only for the same consented route | `route-continuity.spec.tsx` |
| Browser rejects or releases the lock | UI never calls GPS active; it shows recovery guidance and an explicit retry | `route-continuity.spec.tsx` |
| Route changes or component unmounts | Consent resets and the previous sentinel releases | `route-continuity.spec.tsx` |
| A request resolves after opt-out | The stale sentinel is immediately released and cannot reactivate the control | `route-continuity.spec.tsx` |
| GPS document visibility recovery | A fresh retry runs on return without bypassing the 10-second upload interval | `driver-tracking.spec.tsx` |
| Stale foreground acknowledgement | UI crosses from live to delayed after 30 seconds and never promotes itself from wake-lock state | `driver-tracking.spec.tsx` |

## Physical-device matrix

Run this matrix on the deployed production build. Do not mark a row passed from
emulation, a desktop browser, or vendor support tables. Record the device model,
exact OS and browser versions, installation mode, date, anonymized tester
role/reference, route duration, and sanitized observations in the result cell.
Never record a device name, serial number, account ID, or route/run ID.

| Target | Foreground + wake lock | App switch 2 min | Explicit screen lock 2 min | Permission after resume | Network loss/recovery | Battery and thermal result | Sign-off |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Supported iPhone, Safari tab | Not yet observed | Not yet observed | Not yet observed | Not yet observed | Not yet observed | Not yet measured | Pending |
| Supported iPhone, Home Screen | Not yet observed | Not yet observed | Not yet observed | Not yet observed | Not yet observed | Not yet measured | Pending |
| Supported Android, Chrome tab | Not yet observed | Not yet observed | Not yet observed | Not yet observed | Not yet observed | Not yet measured | Pending |
| Supported Android, installed app | Not yet observed | Not yet observed | Not yet observed | Not yet observed | Not yet observed | Not yet measured | Pending |

### Representative route protocol

Use a production-like account and a non-customer test route. Never paste raw
coordinates, customer data, account/run identifiers, or unsanitized logs into
this document.

1. Charge the device above 80%, unplug it, disable low-power mode, set brightness
   to 50%, remove the case, and record ambient temperature.
2. Run at least 60 minutes with eight or more physical stops, normal navigation,
   QR use, and the route screen visible with wake lock enabled.
3. Record the largest gap between server acknowledgements, time to recover after
   each visibility/network interruption, unexpected permission prompts, and
   whether a fresh position replaces the pre-suspension sample.
4. Repeat app switching, explicit screen locking, and a two-minute network loss.
   Confirm the UI becomes delayed/offline rather than claiming live tracking.
5. Record battery percentage at start and finish. Report percentage points per
   hour. On Android, also record the OS-reported battery temperature before and
   after; on iOS, record any thermal warning, marked dimming, or device heat as
   none/mild/high because Safari exposes no dependable thermal sensor.
6. Repeat the foreground run once without wake lock on the same device and
   comparable route conditions. Record the battery difference and any screen-off
   tracking gaps.

## Release thresholds

The web/PWA route is approved only when all supported targets meet every
foreground requirement:

- no server-acknowledgement gap exceeds 30 seconds while the route is visible,
  connected, and wake-locked;
- every app-switch, screen-lock, permission, and network test returns to a fresh
  server acknowledgement within 30 seconds after the route becomes visible;
- no stale pre-suspension point is uploaded after its 120-second TTL;
- wake-lock consent and release behave as documented;
- the representative wake-locked route uses no more than 20 percentage points
  of battery per hour, adds no more than 8 percentage points per hour versus the
  comparable foreground control, and produces no OS thermal warning or marked
  thermal throttling.

These initial battery thresholds are an operational release gate, not a claim
about device capability. Revisit them only with recorded route evidence.

## Native or wrapped go/no-go

Use a wrapped/native driver application with an OS background-location service
when either condition is true:

1. Product requires “live” customer tracking while the driver intentionally
   locks the screen or uses another application. The web build is an immediate
   **no-go** for that promise because screen wake lock cannot supply background
   location.
2. Any supported foreground target misses the acknowledgement, recovery,
   battery, or thermal release thresholds in two controlled runs after browser
   and application defects have been excluded.

Until every physical-device row is signed off, the supported promise is
foreground tracking with truthful delayed/offline recovery—not locked-screen or
background live tracking.
