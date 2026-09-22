# Preview flag-definition authentication failures

## Reviewable fix — prepared, not applied

Create the non-secret setting in [preview-env.json](./preview-env.json) on
**only the `www` and `garden` Vercel projects, only for Preview**:
`VERCEL_FLAGS_EMBED_DEFINITIONS=force-off`.

This disables the CLI's optional build-time flag snapshot fetch before it can
fail with 401. It leaves application flag declarations, SDK authentication,
`FLAGS_SECRET`, Flags Explorer discovery, and production configuration intact.
Preview builds lose the embedded snapshot and its runtime fallback when the
flag service is unavailable; normal SDK fetching/default behavior still applies.
This mitigates the build integration failure; it does not repair Vercel's token
issuance or refresh lifecycle.

The payload has not been submitted. The investigation did not expose, change,
or rotate credentials, change remote settings, or initiate a deployment.
Merging these review artifacts does not apply the proposed setting.

## Evidence and authentication

Investigated on 22 September 2026 against current `main`
`db3d4cebbcabd4a68b0925e9e1698fe20e77f522`, starting with issue 2 of the
22 September `gredice-vercel-review` automation report. Authenticated read-only
deployment metadata and build-event reads reconfirmed all seven failures.

All used **Vercel CLI 59.23.2**, reported `401 Unauthorized` from flag-definition
fetching, and identified the failing credential as an obfuscated JWT. No token
prefixes or credential values are retained here. The deployment claim metadata
matched the project and Preview environment in every case:

| Claim | Value |
| --- | --- |
| Issuer | `https://oidc.vercel.com/gredice` |
| Audience | `https://vercel.com/gredice` |
| WWW subject/scope | `owner:gredice:project:www:environment:preview` |
| Garden subject/scope | `owner:gredice:project:garden:environment:preview` |

The [OIDC reference](https://vercel.com/docs/oidc/reference) documents a **one-hour
lifetime for Preview/Production tokens**, versus 12 hours for Development.
The API's claim metadata does not contain `iat` or `exp`, and the log formatter
obfuscates the token payload. Therefore **actual expiry of the historical tokens
is not proven**. Queue delay is a strong explanation, conditional on a token
being issued before the queue wait; its issuance time is not observable here.
Correct claim metadata rules out an obvious project/environment mismatch, but
does not independently verify the historical token's signature or acceptance.

All times below are UTC on **21 September 2026**. Queue wait is
`buildingAt - createdAt`, not measured token age.

| Project / branch | Deployment | Queue wait |
| --- | --- | ---: |
| WWW / `feat/faq-category-visuals` | `dpl_B5yz59iwRDHR5JKE9aKyyWAvdU2i` | 81.59 min |
| Garden / `feat/faq-category-visuals` | `dpl_326eRxDZfXzrzcmaNuhnFqpz9jgM` | 80.65 min |
| WWW / `feat/public-garden-members` | `dpl_6UnWGPWLGEnbWXxNu6MJ4uF6W5zN` | 69.67 min |
| Garden / `feat/public-garden-members` | `dpl_7vcSdHPRnH7HdZ7nLW1jp8kDCSPH` | 69.94 min |
| WWW / `feat/footer-origin-prominence` | `dpl_GbFoA5myBnju1rFxAK2uKYSa5rUU` | 66.86 min |
| Garden / `feat/footer-origin-prominence` | `dpl_3rDLVqaHAGyqASpJE6TH7p2dhWsh` | 67.16 min |
| Garden / `feat/public-footer-panorama` | `dpl_7GVjq32bpziCYYfayibykAZeeRRN` | 61.91 min |

The representative WWW deployment was created at 21:44:20, started building at
23:05:56, and logged the 401 at 23:06:09. All seven failures occurred between
22:40:11 and 23:06:09. Successful production controls on the same CLI version,
WWW `dpl_E3862dCboRos6cHGm7fyLQZX6TTN` and Garden
`dpl_4gLYKUeVgeWkMeMoBpeP6M463Xcd`, waited 5.23 and 0.28 minutes respectively.
This supports a lifetime/queue interaction rather than an unconditional CLI
failure, but does not prove the server-side reason for rejecting the tokens.

## Confirmed integration cause

Inspection of the published **`vercel@59.23.2`** tarball and its dependency
**`@vercel/prepare-flags-definitions@0.3.0`** establishes this chain:

1. Both apps declare `@flags-sdk/vercel@1.4.6`. The CLI's
   `shouldEmbedFlagsDefinitions` enables embedding for this dependency, even
   when no `FLAGS` SDK-key environment variable exists.
2. `vc.prepareFlagsDefinitions` runs during `vercel build` setup, before the
   ordinary install/build commands. Changing `next.config`, app flag functions,
   `pnpm build`, or the GitHub Actions CLI pin cannot fix this hosted setup step.
3. The helper collects SDK keys **and** `VERCEL_OIDC_TOKEN`, then sends each as
   a bearer token to `https://flags.vercel.com/v1/datafile`. It tolerates 404 but
   throws on 401; `Promise.all` propagates any entry's failure. There is no
   refresh, expiry check, or OIDC-specific fallback in this helper.
4. All seven deployments had `VERCEL_OIDC_TOKEN` and `FLAGS_SECRET`, no `FLAGS`,
   and neither embedding override. The project environment metadata contained
   `FLAGS_SECRET` but no manually configured OIDC or embedding setting.
   `FLAGS_SECRET` protects override/discovery access and is not the bearer
   credential used by this fetch. GitHub's `VERCEL_TOKEN` is also a separate
   credential: these deployments have `source=git`.
5. The exact CLI checks `VERCEL_FLAGS_EMBED_DEFINITIONS=force-off` before
   dependency detection and before invoking the helper. Adding an SDK key would
   not bypass the failing OIDC entry. Removing OIDC would affect other consumers.

Upstream references:
[OIDC integration change](https://github.com/vercel/flags/pull/390),
[embedding gate](https://github.com/vercel/vercel/blob/main/internals/cli-builder-integration/src/build-embedding.ts),
[flag snapshot behavior](https://vercel.com/docs/flags/vercel-flags/quickstart).
The moving source link is background; validation below uses the exact published
packages, including the CLI's package-manifest detection fallback.

## Applying after review

Project settings are the narrowest fix because they can target Preview before
CLI startup. A static `vercel.json` `build.env` override would also affect future
production builds. No application change is needed.

Immediately before applying, inspect environment **metadata only** on both
projects and confirm neither embedding override has since been added. If a
setting exists, reconcile its targets instead of overwriting a shared
Preview/Production record. At investigation time both were absent.

These commands are provided for a later authorized application; they were
**not executed**. They use the existing CLI login, require no new secret, and
do not initiate a deployment. No `upsert` is used, so a conflicting record
should be inspected rather than overwritten.

```sh
vercel api /v10/projects/www/env --scope gredice --method POST \
  --input docs/vercel-preview-flags/preview-env.json
vercel api /v10/projects/garden/env --scope gredice --method POST \
  --input docs/vercel-preview-flags/preview-env.json
```

The payload follows the [project environment API](https://vercel.com/docs/rest-api/reference/endpoints/projects/create-one-or-more-environment-variables).
Read back the new record IDs and confirm `type=plain`, `target=[preview]`, and
the intended value. Rollback is removal of only those newly created Preview
records. Existing failed deployments are not repaired by changing settings.

After the setting is applied, verify that a new preview passes CLI setup,
reaches READY, and preserves authenticated Flags Explorer and managed flag
evaluation. A queued preview exceeding one hour is the relevant acceptance
case. Platform confirmation of historical expiry/token refresh remains a
separate investigation; the sanitized IDs and timestamps above are sufficient
for escalation without sending credentials.

## Offline validation

The seven checks in [verify.mjs](./verify.mjs) passed on Node 24.15.0. They
execute the embedding gate extracted from CLI 59.23.2 and the published helper
with synthetic credentials and injected responses. They reproduce fatal OIDC
401s for both manifests, prove the proposed override skips fetching, show that
an SDK key does not mask an OIDC failure, and retain embedding on an unaffected
production control. No real authentication or application build is exercised.

To repeat from the repository root, download the public packages into a
temporary directory, then run the verifier:

```sh
flags_check_dir=$(mktemp -d)
mkdir -p "$flags_check_dir/cli" "$flags_check_dir/prepare"
curl -fsSL https://registry.npmjs.org/vercel/-/vercel-59.23.2.tgz \
  -o "$flags_check_dir/cli.tgz"
curl -fsSL https://registry.npmjs.org/@vercel/prepare-flags-definitions/-/prepare-flags-definitions-0.3.0.tgz \
  -o "$flags_check_dir/prepare.tgz"
tar -xzf "$flags_check_dir/cli.tgz" -C "$flags_check_dir/cli"
tar -xzf "$flags_check_dir/prepare.tgz" -C "$flags_check_dir/prepare"
node docs/vercel-preview-flags/verify.mjs \
  "$flags_check_dir/cli/package" "$flags_check_dir/prepare/package"
```

`git diff --check` also passed. Offline validation did not run a full app build
or hosted preview: these review artifacts contain no application changes.
Git integration builds for this PR do not apply the environment payload.
Live recovery remains unverified until the setting is applied and a new
preview build completes.
