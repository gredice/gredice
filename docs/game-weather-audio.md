# Weather ambience

`Environment` passes the resolved forecast/debug weather to `WeatherAmbience`.
The seven existing CDN recordings stay registered on the shared ambient mixer;
only their target gains change. All layers use its master/ambient volume and
mute controls, audio unlock, decoded-buffer cache and background lifecycle.

## Targets and transitions

- Forecast values and debug overrides are instantaneous **targets**. Audio does
  not consume visually blended weather, so it does not wait for visual settling.
- `resolveWeatherAmbience` continuously mixes morning/day/night around normalized
  time 0.15, 0.30 and 0.80. Rain crossfades light/medium/heavy textures across
  intensity 0–1; daytime birds blend into the existing daytime rain bed. Storms
  retain a quiet time-of-day bed. Combined target gain stays below 0.9 before
  master/ambient volume, leaving space for leaf rustle.
- Snowfall intensity and snow accumulation (0–30 cm) lower the time-of-day bed by
  up to 30%. There is currently no separate falling-snow recording. Accumulation
  changes use the same gain envelope as forecast changes.
- Mixer gains use exponential time constants of **0.8 s normally**, **0.2 s with
  debug overrides**: approximately 95% settled in 2.4 s / 0.6 s. Retargeting holds
  the current gain, so rapid updates continue from the audible level.
- Identical targets do nothing. A zero target fades out and releases its source
  after five constants (4 s / 1 s); reactivation during that tail cancels disposal.
  Later activation reuses the decoded buffer. Sound disablement, scene hiding,
  page backgrounding and unmount stop immediately; foregrounding fades back in.
- Missing/undecodable layers fail quietly and do not retry on every forecast
  refresh. Remounting the layer permits a new load attempt.

The existing leaf-rustle layer independently consumes blended wind and seasonal
leaf presence, using a 0.3 s mixer constant. Thunder remains a discrete event.
Changing audio targets never changes HUD values or visual interpolation.

## QA

Open `/debug/profile/game?mode=autumn&sound=1&hud=1&debugHud=1` and click inside
the page to unlock audio. Sweep rain 0 → 0.5 → 1 → 0, then repeat quickly; move
time across dawn/day/dusk, and vary snow and accumulation. Listen for continuous
changes with the garden bed still present under rain. Debug fades should settle
within about a second. Clear the overrides to check the slower forecast fades.
Verify master and ambient volume/mute, sound-disabled scenes, tab hide/resume
and missing assets. Leaf rustle and rain should remain distinguishable.

Automated coverage includes gain continuity/bounds and snow targets, existing
mixer lifecycle/race tests, plus `tests/weather-audio.spec.tsx` with actual browser
Web Audio decoding and React updates. Its rain recordings are intercepted with
a deterministic local WAV to keep CI offline. These checks verify scheduling,
source/cache ownership and browser gain changes; speaker/headphone mix quality
requires listening.

## Wind layers

`WindAmbience` adds light, medium and strong wind under the same mixer controls.
It reads the instantaneous resolved `windSpeed` on the **0–3 scene/API scale**,
using the same normal/debug envelopes as rain. Calm (0–0.25) stays silent, light
wind fades in by 1, and textures crossfade from light to medium over 1–2 and
medium to strong over 2–3. Their total gain rises from 0.12 at 1 to at most 0.26
at 3; full rain ducks wind by 30%. Snow does not switch wind off. Low/mid-band
wind and the sparse high-frequency leaf layer can play together.

`python3 assets/generate-wind-ambience.py` deterministically generates three
original 12-second, 22,050 Hz, mono 16-bit WAVs in both garden and WWW public
assets. The files use versioned `wind-{light,medium,strong}-v1.wav` names and
load lazily through the existing decoded-buffer cache. There are no external
samples or licensing dependencies. Circular filtered noise and periodic gusts
produce continuous loop seams. RMS is 0.10 / 0.12 / 0.14 and peak is below 0.57;
assets total about 1.6 MB per host. They add no synthesis work during playback.

For wind QA, use the debug Wind slider at 0, 1, 2 and 3, then switch quickly
between 0 and 3 and back. Allow at least 12 seconds to hear a complete loop.
Combine rain, snow, autumn leaves and day/night; verify wind remains subordinate
to the scene and that master/ambient mute and volume still control every layer.
`tests/wind-audio.spec.tsx` decodes all three shipped files in Chromium and checks
rapid retargeting, calm fade-out, caching, mute, volume, disablement and missing
assets. PCM checks verify identical host copies, format, level and loop seams.
