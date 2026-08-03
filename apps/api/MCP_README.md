# Gredice MCP server

Gredice exposes one supported Streamable HTTP MCP endpoint for Croatian plant
knowledge, authenticated garden context, and authenticated cart management:

```text
https://api.gredice.com/api/mcp
```

The public user guide is at
[`https://www.gredice.com/mcp`](https://www.gredice.com/mcp). Older
domain-specific routes under `/api/mcp/{core,directories,gardens,commerce}` are
not part of the public contract and return `404`.

## Rollout controls

`GREDICE_MCP_PUBLIC_ENABLED` is fail-closed. When unset or false, anonymous
protocol discovery, public tools, protected-resource metadata, and the `/test`
console return `404`. Existing internal calls to protected tools may still
present a bearer token and continue through normal authorization.

Accepted explicit true values are `1`, `true`, `yes`, `on`, and `enabled`.

`MCP_ROLLOUT_STAGE` controls the enabled tool class after public access is on:

| Value | Behavior |
| --- | --- |
| `public-read-only` | Only `public-read` tools execute. |
| `auth-read-only` | Public and authenticated read tools execute; mutations return `403`. |
| `all` or unset | All catalog tools may execute subject to authorization. |

Optional `MCP_ALLOWED_ORIGINS` is a comma-separated origin allowlist. An empty
value does not restrict origins.

## Protocol

- Transport: Streamable HTTP JSON-RPC 2.0.
- Supported versions: `2025-03-26` and `2024-11-05`.
- Methods: `initialize`, `tools/list`, `tools/call`, `resources/list`,
  `resources/templates/list`, and `prompts/list`.
- Maximum request body: 256 KiB.
- Tool timeout: 8 seconds.
- Rate limits: currently per runtime instance; shared production limits remain
  required before official marketplace publication.

Example anonymous call:

```sh
curl https://api.gredice.com/api/mcp \
  -H 'Content-Type: application/json' \
  --data '{
    "jsonrpc": "2.0",
    "id": "plants",
    "method": "tools/call",
    "params": {
      "name": "directories/get-plants",
      "arguments": { "limit": 5, "offset": 0 }
    }
  }'
```

## Authorization

Only `directories/get-plants` is anonymous. Other tools require a standard
Gredice API bearer token:

```http
Authorization: Bearer <access-token>
```

The unified server validates the token with `GREDICE_JWT_SIGN_SECRET`, derives
the user and selected account from authorization, verifies ownership, and then
checks these MCP scopes:

| Exposure | Scope |
| --- | --- |
| `public-read` | none |
| `auth-read` | `mcp:read` |
| `auth-mutation` | `mcp:write` |
| `admin-internal` | `mcp:admin` |

Protected-resource metadata is available at
`/.well-known/oauth-protected-resource/api/mcp` while public MCP access is
enabled. Official external publication additionally requires a complete OAuth
2.1 authorization-code and PKCE flow plus authorization-server discovery; see
[`docs/plugin-marketplaces.md`](../../docs/plugin-marketplaces.md).

## Tool catalog

Tool annotations are included in `tools/list`. All read tools use
`readOnlyHint: true`; cart mutations use `readOnlyHint: false`; all tools use
`openWorldHint: false`; and `commerce/update-cart-item` is destructive because
quantity zero removes an item.

| Tool | Exposure | Purpose |
| --- | --- | --- |
| `directories/get-plants` | public read | List Croatian plants and calendar data. |
| `directories/get-plant` | authenticated read | Get one plant and optional sorts. |
| `directories/get-plant-sorts` | authenticated read | List plant sorts. |
| `directories/search-entities` | authenticated read | Search directory entities. |
| `directories/get-operations` | authenticated read | List gardening operations. |
| `directories/get-seeds` | authenticated read | List seed data. |
| `gardens/list-gardens` | authenticated read | List gardens for the selected account. |
| `gardens/list-raised-beds` | authenticated read | List raised beds in an owned garden. |
| `gardens/get-raised-bed-fields` | authenticated read | Read field and plant lifecycle state. |
| `gardens/list-operations` | authenticated read | List scheduled and completed operations. |
| `gardens/get-lifecycle-context` | authenticated read | Summarize active plant lifecycle state. |
| `gardens/get-raised-bed-ai-history` | authenticated read | Read saved AI suggestions for a bed. |
| `commerce/get-products` | authenticated read | List available plant-sort products. |
| `commerce/search-products` | authenticated read | Search available plant-sort products. |
| `commerce/get-product` | authenticated read | Get one product. |
| `commerce/get-cart` | authenticated read | Read the selected account cart. |
| `commerce/add-to-cart` | authenticated mutation | Add a product to the cart. |
| `commerce/update-cart-item` | authenticated mutation | Change quantity or remove a cart item. |

Cart tools derive ownership from the bearer token. Clients must not send or ask
users for account or user IDs. The catalog exposes only identifiers needed to
select products, gardens, beds, fields, or existing cart items.

## Resources

The server advertises public directory metadata at:

- `gredice://directories/entity-types`
- `gredice://directories/entity-types/{entityTypeName}`

The templates are discovery metadata; resource reads should not be treated as a
stable public contract until `resources/read` is implemented.

## Plugin package

Installable Codex/ChatGPT and Claude source lives in
[`plugins/gredice`](../../plugins/gredice). It contains aligned manifests, the
canonical remote server configuration, skills, brand assets, and marketplace
submission evals. Repository catalogs live at:

- `.agents/plugins/marketplace.json`
- `.claude-plugin/marketplace.json`

Run `pnpm plugins:check` to verify package, marketplace, tool, skill, and eval
alignment.

## Validation

From the repository root:

```sh
pnpm plugins:check
pnpm typecheck --filter api
pnpm --filter api test:node
pnpm --filter api test:run -- tests/mcp.spec.ts
```

The Playwright authenticated account-isolation test requires
`GREDICE_MCP_TEST_BEARER_TOKEN` and `GREDICE_MCP_TEST_ACCOUNT_ID`. Do not use
production customer credentials for marketplace fixtures.
