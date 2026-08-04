# Gredice plugin publication checklist

Status: repository package prepared; official OpenAI and Anthropic submissions
remain blocked on production OAuth and reviewer-safe end-to-end verification.

Last reviewed against vendor documentation: 2026-08-03.

Gredice uses one release unit at [`plugins/gredice`](../plugins/gredice): aligned
Codex and Claude manifests, one remote MCP configuration, three skills, brand
assets, and submission eval fixtures. Keep both manifest versions identical and
use strict semantic versions.

## Prepared in this change

- [x] Package `gredice@0.1.0` with `.codex-plugin/plugin.json` and
  `.claude-plugin/plugin.json`.
- [x] Shared Streamable HTTP server configuration for
  `https://api.gredice.com/api/mcp`.
- [x] Skills for public plant research, read-only garden review, and confirmed
  cart changes.
- [x] Repository catalogs for Codex and Claude installation testing.
- [x] Five positive and three negative OpenAI review fixtures.
- [x] Accurate `readOnlyHint`, `openWorldHint`, and `destructiveHint`
  annotations on every unified MCP tool.
- [x] Public Croatian MCP documentation, support, privacy, and terms URLs.
- [x] Always-public unified MCP endpoint, per-tool authorization, and removal
  of the legacy domain-specific route handlers.
- [x] Scheduled and manually dispatchable production smoke for discovery,
  anonymous directory/product reads, metadata, and the private-data auth
  boundary.
- [x] Package validation command and CI coverage.

## Official-release TODO

### Production MCP and authorization

- [ ] Deploy the merged API and www changes through the protected production
  release workflow; do not treat the repository merge as deployment evidence.
- [ ] After deployment, confirm the `MCP public smoke` workflow passes against
  the canonical production URL. It also runs automatically every six hours.
- [ ] Implement and verify OAuth 2.1 authorization-code plus PKCE for MCP
  clients. Publish protected-resource and authorization-server metadata,
  preserve the exact `resource` value through authorization and token exchange,
  and support CIMD, DCR, or explicitly registered public clients.
- [ ] Replace any issuer fallback with the production authorization-server
  issuer and prove token audience, expiry, scopes, account ownership, refresh,
  revocation, and `401 WWW-Authenticate` behavior.
- [ ] Create a synthetic reviewer account and garden that contain no production
  customer data and can authenticate without MFA, SMS, email confirmation, or
  private-network access.
- [ ] Run fresh-profile OAuth and tool-call smokes from ChatGPT, Codex, Claude,
  MCP Inspector, and one generic Streamable HTTP client.
- [ ] Move MCP rate limits from the current per-instance memory store to shared
  production storage and add alerting for repeated authorization and tool-call
  failures.
- [ ] Audit response payloads for unnecessary personal data, raw internal IDs,
  secrets, debug details, and unstable fields; add useful output schemas and
  stable public error messages before review.
- [ ] Decide and document the compatibility/deprecation policy for published
  tool names and response shapes.

### OpenAI universal Plugins Directory

OpenAI publishes one reviewed listing shared by ChatGPT and Codex. The
repository marketplace is for development and does not publish the plugin.
Follow the current [OpenAI submission guide](https://developers.openai.com/plugins/deploy/submission)
and [authentication contract](https://developers.openai.com/plugins/build/auth).

- [ ] Give the submitter **Apps Management: Write** in the publishing OpenAI
  organization and complete Gredice business identity verification.
- [ ] Confirm the public listing name, descriptions, logo, category, website,
  `https://www.gredice.com/kontakt`, privacy policy, terms, support ownership,
  and country availability all match the verified publisher.
- [ ] In ChatGPT developer mode, register the production MCP URL and run local
  plugin tests. If a registered connection is packaged for local ChatGPT
  testing, add its real `.app.json` mapping and manifest `apps` field; never
  commit a fabricated `plugin_asdk_app...` identifier.
- [ ] In the OpenAI plugin submission portal, create a new **With MCP** draft
  using the universal server URL. Submit the MCP server itself, not an existing
  integration identifier.
- [ ] Complete the generated domain challenge at
  `/.well-known/openai-apps-challenge` on `api.gredice.com` and remove or rotate
  the token only through the documented verification lifecycle.
- [ ] Select **Scan Tools** and verify names, descriptions, input and output
  schemas, annotations, authentication, and imported skills against production.
- [ ] Upload the final checked-in skill tree and copy the three starter prompts
  from the Codex manifest.
- [ ] Execute all five positive and three negative cases from
  `plugins/gredice/evals/openai-submission.json` with reviewer credentials.
- [ ] Complete policy attestations and submit for review. Approval is not
  publication: inspect the approved snapshot and explicitly select **Publish**
  while all production gates remain green.
- [ ] After publication, install Gredice from the public Plugins Directory in a
  fresh ChatGPT and Codex profile and repeat public, authenticated read, cart
  write, revocation, and negative tests.

### Claude plugin marketplaces

The repository catalog supports direct installation today. Third-party public
submissions go to Anthropic's `claude-community` marketplace after automated
validation and safety review. The curated `claude-plugins-official` marketplace
is selected separately at Anthropic's discretion and has no application flow.
Follow the current [Claude plugin guide](https://code.claude.com/docs/en/plugins)
and [marketplace guide](https://code.claude.com/docs/en/plugin-marketplaces).

- [ ] Run `claude plugin validate plugins/gredice --strict` and
  `claude plugin validate .claude-plugin/marketplace.json --strict` with the
  current stable Claude Code release.
- [ ] From a clean public clone, add the Gredice repository marketplace,
  install `gredice@gredice`, authenticate through `/mcp`, reload plugins, and
  run the complete eval fixture in a fresh conversation.
- [ ] Submit the public repository and exact `plugins/gredice` source directory
  through the Claude Console plugin form. If using claude.ai, confirm the Team
  or Enterprise organization has directory-management access.
- [ ] Verify the approved commit pin in `anthropics/claude-plugins-community`
  after the nightly catalog sync, then install `gredice@claude-community` from
  a fresh profile and repeat the OAuth and eval smokes.
- [ ] Treat inclusion in `claude-plugins-official` as a later discretionary
  Anthropic curation outcome, not a release dependency or promised milestone.

## Release validation

Run from the repository root before every package release:

```sh
pnpm plugins:check
pnpm mcp:smoke:public
python3 /path/to/plugin-creator/scripts/validate_plugin.py plugins/gredice
python3 /path/to/skill-creator/scripts/quick_validate.py plugins/gredice/skills/explore-plants
python3 /path/to/skill-creator/scripts/quick_validate.py plugins/gredice/skills/review-garden
python3 /path/to/skill-creator/scripts/quick_validate.py plugins/gredice/skills/plan-garden-cart
claude plugin validate plugins/gredice --strict
claude plugin validate .claude-plugin/marketplace.json --strict
pnpm typecheck --filter api
pnpm --filter api test:node
pnpm --filter api test:run -- tests/mcp.spec.ts
```

The Python validators require PyYAML. Install it only in an isolated tooling
environment if the system Python does not provide it.

`pnpm mcp:smoke:public` uses the official MCP SDK against production by
default. Set `MCP_SMOKE_URL` to verify another deployed endpoint. It never uses
customer credentials or reads private garden/cart data.

## Updating or withdrawing a release

1. Make MCP changes backward-compatible and deploy them through the protected
   release workflow.
2. Bump both plugin manifests together and update skills, starter prompts,
   evals, and release notes as one unit.
3. Re-run validators and fresh-profile authenticated smokes.
4. OpenAI requires a new tool scan, reviewed snapshot, approval, and explicit
   publication. Claude requires a new explicit version and verified catalog
   commit pin.
5. For an emergency runtime rollback, revert through the protected production
   release workflow and separately use each vendor's delisting or rollback
   process. Neither action replaces token revocation.
