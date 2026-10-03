# Steam profile fixture isolation verification

Fresh local verification on 2026-10-03, based on source commit `53340d57d2d8660c06f9deb2a2d5dd95791e9536` plus the single fixture prop `Environment.noDistantBirdFlocks`. This excludes rare flock crossings from the matched baseline/steam workload on slow or long captures. It does not change production runtime, profile budgets, timeouts or screenshots.

The prior [tea evidence](../localized-steam-2026/validation.json) and [mixed cart evidence](../chestnut-steam-2026/validation.json) retain their original source/capture identity. They have not been relabelled as this source. These six new profiles are separate evidence.

All **6/6** low/medium/high matched tea and mixed-cart tests passed, one Chromium headless SwiftShader worker on port **5487**, Node 24.15.0, pnpm 12.5.1, Playwright 1.62.1. Each baseline/candidate sampled 120 rendered frames after the existing 60-frame warm-up. Existing limits stayed at 1.1 additional draw calls and 110 additional triangles. Software-renderer frame timings remain diagnostic and are not a device performance claim. This does not address the known CI duration or hedgehog snapshot failures.

| Scenario | Tier | Additional calls | Additional triangles | Steam particles |
| --- | --- | ---: | ---: | ---: |
| mixed-tea-cart | low | 0.000 | 0.000 | 0 |
| mixed-tea-cart | medium | 1.000 | 48.000 | 24 |
| mixed-tea-cart | high | 1.000 | 96.000 | 48 |
| tea | low | 0.000 | 0.000 | 0 |
| tea | medium | 1.000 | 48.000 | 24 |
| tea | high | 1.000 | 96.000 | 48 |

Reproduction uses the existing configs/tests, selecting only their matched profile cases:

```sh
pnpm --filter garden exec playwright test --config playwright.steam.config.ts --grep 'profile steam with dense'
pnpm --filter garden exec playwright test --config playwright.chestnut-steam.config.ts --grep 'matched mixed tea/cart'
```

The recorded run combined those unchanged configs' profile cases in an ephemeral config with only their test selection and port set to 5487. The ephemeral config SHA256 was `7fcae96bc510ccab025eac0559faa382f39dd72bfd36666709d0559cb9d1889d`. The full local runner log is `/tmp/gredice-steam-fixture-isolation.log`, SHA256 `5aebc023f86e8e7002aa641c8a62d79e41359efc644c022974441adb3b23c713`. Committed [fresh measurements](profile.json) SHA256: `fadc5488f0710b3f518a37884d8553628a94f678e4356281a2c6755ae6837101`.

Current captured source SHA256:

| File | SHA256 |
| --- | --- |
| `packages/game/tests/SteamProfileFixture.tsx` | `55b09e336909d9e84440d47e80976df02a83817ad17a7022070dc4dc94c78e32` |
| `packages/game/tests/SteamProfileProbe.tsx` | `a6d723f8e5ceb126e09c717fdc156bf825398bea27d9f866297ef4324282b1b6` |
| `packages/game/src/scene/Environment.tsx` | `c33fe3cfe2492025d4a712d9e26d53f90aea6c9e29f9065606ce3985cdf2966f` |
| `packages/game/src/scene/SceneTime.tsx` | `078521dd159074f5ded5135140ccf571ae5ef8451ef89bf2ea010466c7b057bb` |
| `packages/game/src/scene/SteamEmitter.tsx` | `89e796792b757e06192243929f51d94c9b8eba5901d4628bc0d8e7bb12ac0f05` |
| `packages/game/src/scene/LocalizedSteam.tsx` | `cfecd8de0f495c89707e4f489017461fda1f205bf1ac8a6fbad155b2e26b53c1` |
| `packages/game/src/scene/SteamSources.tsx` | `ffdcbd70b2078d97379856e335673fa0a65cec33315186afdc2ace4563483dfc` |
| `apps/garden/tests/localized-steam.spec.tsx` | `8494e4e48fc54508c05f370cd88bda881b1181a8d6adeba9e665ee95d80682df` |
| `apps/garden/tests/chestnut-steam.spec.tsx` | `b64c3cae745afadc6715fad6b95c2cb82948c4a2408343d4b37f818112205e72` |
