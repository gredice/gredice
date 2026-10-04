# Desktop Apps

Gredice ships Electron desktop shells for these deployed web apps:

| Desktop app | Source app | Release URL |
| --- | --- | --- |
| Gredice Garden | `apps/garden` | `https://vrt.gredice.com` |
| Gredice Farm | `apps/farm` | `https://farma.gredice.com` |
| Gredice Admin | `apps/app` | `https://app.gredice.com` |

The desktop apps intentionally load the production HTTPS origins instead of
embedding a local Next.js server. The `farm` and `app` workspaces depend on
server-side credentials and private backend access; those secrets must stay on
the deployed services, not inside a downloadable desktop bundle.

On macOS, the Electron shell enables native window vibrancy and injects a
desktop-only glass stylesheet. Page backgrounds and plain app surfaces become
semi-transparent over the blurred system backdrop, while existing cards,
dialogs, form controls, and popovers keep their app-defined container styling.
The shell also uses a hidden-inset native titlebar so the macOS traffic-light
window controls remain visible and the top glass strip is draggable.

All desktop shells inject a small base stylesheet for desktop-only polish,
including suppressing the hosted app logotype in header surfaces where the
native app frame already provides identity.

OAuth login is handed off to the system browser instead of running provider
login inside Electron. The desktop shell registers a native callback protocol
(`gredice-garden://`, `gredice-farm://`, or `gredice-admin://`), opens
`https://api.gredice.com` for Google/Facebook login, then forwards the returned
session token fragment into the local app callback page so Electron's own
session receives the app cookies.

## Commands

Install dependencies from the repo root first:

```bash
pnpm install
```

Build release artifacts for the current operating system:

```bash
pnpm desktop:dist:garden
pnpm desktop:dist:farm
pnpm desktop:dist:app
```

Build all three desktop apps for the current operating system:

```bash
pnpm desktop:dist
```

Pass Electron Builder platform flags through the package script when producing
specific target families:

```bash
pnpm --filter desktop dist:garden -- --mac
pnpm --filter desktop dist:garden -- --win --x64
pnpm --filter desktop dist:garden -- --all-platforms
```

Artifacts are written to `apps/desktop/dist/<app>`. Local unpacked builds can be
created with `pnpm --filter desktop pack:garden`, `pack:farm`, or `pack:app`.

## Release Workflows

GitHub release workflows publish macOS arm64 DMGs only. Push one of these tags
to release the matching desktop app:

```bash
git tag desktop-garden-v1.2.3
git tag desktop-farm-v1.2.3
git tag desktop-app-v1.2.3
```

The same workflows can also be run manually with a `version` input; without one,
they create a timestamped version.

## Local QA

Launch the Electron shell and the local services it needs:

```bash
pnpm desktop:dev:garden
pnpm desktop:dev:farm
pnpm desktop:dev:app
```

Each desktop dev command starts `api` and the selected app if their local dev
ports are not already listening, then points Electron at the selected local app
origin. When Electron exits, any dev servers started by the desktop command are
stopped. Servers that were already running before the command are left alone.

During desktop dev, app data requests still use the local API. Google/Facebook
OAuth uses the production API by default because local worktrees normally do
not have provider OAuth secrets. Override this only when testing a local API
with provider credentials:

```bash
GREDICE_DESKTOP_EXTERNAL_AUTH_BASE_URL=http://localhost:<api-port> pnpm desktop:dev:app
```

Local `http://localhost` desktop sessions use non-secure development auth
cookies automatically; HTTPS and packaged app sessions keep secure cookies.

## Signing

GitHub release workflows can publish without Apple Developer Program
credentials. Without a Developer ID certificate, Electron Builder falls back to
ad-hoc macOS signing and the app is not notarized. This keeps releases possible
for internal or manual distribution, but macOS Gatekeeper can still show
unidentified-developer warnings for downloaded artifacts.

For public releases that should open normally after download, configure these
GitHub secrets for Developer ID signing:

- `CSC_LINK`: base64-encoded `.p12` Developer ID Application certificate or a
  secure URL supported by Electron Builder.
- `CSC_KEY_PASSWORD`: certificate password, when the `.p12` is encrypted.

For notarization, prefer App Store Connect API key secrets:

- `APPLE_API_KEY`: contents of the downloaded `AuthKey_<key-id>.p8` file.
- `APPLE_API_KEY_ID`: App Store Connect API key ID.
- `APPLE_API_ISSUER`: App Store Connect issuer UUID.

When `CSC_LINK` is configured, the workflows also support Apple ID
notarization via `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and
`APPLE_TEAM_ID`, or an existing notarytool keychain profile via
`APPLE_KEYCHAIN_PROFILE` and optional `APPLE_KEYCHAIN`. Do not commit
certificates, app-specific passwords, provisioning profiles, or private keys.

Use `GREDICE_DESKTOP_VERSION=<semver>` to override the package version stamped
into desktop artifacts. Without it, the source app package version is used.
