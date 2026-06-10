# MCP Server Contract And Hardening Spike

This document records Plan 010 for the API MCP surface. It is a contract and
hardening spike, not a runtime behavior change.

Survey date: 2026-06-10.
Planned baseline: `17aca58ba`.
Current base surveyed: `origin/main` at `42216ad7a`.
Drift check: `git diff --stat 17aca58ba..HEAD -- apps/api/app/api/mcp`
returned no MCP source diff.

## Decision Summary

The current source does not prove a partner-facing stability commitment. The
recommended default is:

- Audience: authenticated Gredice end-users and internal agents using their own
  AI clients.
- Partner status: not committed yet.
- Stability: tool names and response shapes are not a versioned partner
  contract until the team explicitly chooses that exposure level.
- Write exposure: write-capable tools should stay behind authenticated user
  authorization, resource ownership checks, and explicit write/purchase scopes.

STOP-condition finding: audience intent cannot be fully inferred from source and
the existing docs. This spike records the default above and does not encode a
partner commitment. If the intended audience becomes third-party partners, the
follow-up work must add contract tests, versioning, a deprecation policy, and
clear ownership for compatibility breaks.

## Endpoint Shape

Gredice currently has one main Streamable HTTP MCP endpoint and older
domain-specific MCP endpoints:

| Route | Purpose | Notes |
| --- | --- | --- |
| `/api/mcp` | Main Streamable HTTP JSON-RPC endpoint | Uses the central catalog, shared API JWT verification, MCP scopes, body cap, timeout, and in-process rate limit. |
| `/api/mcp/.well-known/oauth-protected-resource` | OAuth protected-resource metadata | Delegates to the main server metadata helper. |
| `/.well-known/oauth-protected-resource/api/mcp` | Public protected-resource metadata path | Exposes supported scopes and authorization server metadata. |
| `/api/mcp/core/health` | Health check | Returns server status only. |
| `/api/mcp/directories` | Domain-specific directories endpoint | Legacy-style protocol endpoint with its own tool list and inline tool calls. |
| `/api/mcp/directories/tools/call` | Domain-specific directory tool execution | Calls the directory executor directly. |
| `/api/mcp/gardens` | Domain-specific gardens endpoint | Lists garden read tools and forwards `tools/call` through `MCP_BASE_URL`. |
| `/api/mcp/gardens/tools/call` | Domain-specific garden tool execution | Uses the older MCP auth helper and account ownership checks. |
| `/api/mcp/commerce` | Domain-specific commerce endpoint | Lists a partial commerce tool set and forwards `tools/call` through `MCP_BASE_URL`. |
| `/api/mcp/commerce/tools/call` | Domain-specific commerce tool execution | Uses the older MCP auth helper, user-id checks, and purchase permission for cart writes. |

## Main `/api/mcp` Contract

Supported JSON-RPC methods:

| Method | Auth | Behavior |
| --- | --- | --- |
| `initialize` | None | Negotiates protocol version and returns tool/resource capabilities. |
| `tools/list` | None | Lists the central catalog tools. |
| `tools/call` | Per tool exposure | Executes only central catalog directory tools. |
| `resources/list` | None | Lists static directory resources with entity type data. |
| `resources/templates/list` | None | Lists directory entity schema resource templates. |
| `prompts/list` | None | Returns an empty prompt list. |

Central protocol details:

- Transport: HTTP JSON-RPC, described as `streamable-http`.
- Protocol versions in `server.ts`: `2025-03-26`, `2024-11-05`.
- Request body limit: `MAX_MCP_REQUEST_BODY_BYTES = 256 KiB`.
- Tool timeout: `MCP_TOOL_TIMEOUT_MS = 8s`.
- Rate limiting: in-process `Map`, keyed by client address, request class, and
  method/tool name.
- Scopes: `mcp:read`, `mcp:write`, `mcp:admin`.
- Current role mapping in the main endpoint: `user -> read,write`;
  `admin -> read,write,admin`.

## Tool And Resource Surface

Access uses the effective behavior in source, not the older README wording.

| Name | Domain | Kind | Reads/Writes | Required scope or permission | Entry path |
| --- | --- | --- | --- | --- | --- |
| `directories/get-plants` | directories | tool | Read | None on `/api/mcp` (`public-read`) | `/api/mcp`, `/api/mcp/directories/tools/call`, and `/api/mcp/directories` inline calls. |
| `directories/get-plant` | directories | tool | Read | `mcp:read` on `/api/mcp`; no auth on the domain directory call routes | `/api/mcp`, `/api/mcp/directories/tools/call`, and `/api/mcp/directories` inline calls. |
| `directories/get-plant-sorts` | directories | tool | Read | `mcp:read` on `/api/mcp`; no auth on `/api/mcp/directories/tools/call` | `/api/mcp`, `/api/mcp/directories/tools/call`. |
| `directories/search-entities` | directories | tool | Read | `mcp:read` on `/api/mcp`; no auth on the domain directory call routes | `/api/mcp`, `/api/mcp/directories/tools/call`, and `/api/mcp/directories` inline calls. |
| `directories/get-operations` | directories | tool | Read | `mcp:read` on `/api/mcp`; no auth on `/api/mcp/directories/tools/call` | `/api/mcp`, `/api/mcp/directories/tools/call`. |
| `directories/get-seeds` | directories | tool | Read | `mcp:read` on `/api/mcp`; no auth on `/api/mcp/directories/tools/call` | `/api/mcp`, `/api/mcp/directories/tools/call`. |
| `directories-get-plants` | directories | legacy tool alias | Read | None | `/api/mcp/directories` inline calls. |
| `directories-get-plant` | directories | legacy tool alias | Read | None | `/api/mcp/directories` inline calls. |
| `directories-search-entities` | directories | legacy tool alias | Read | None | `/api/mcp/directories` inline calls. |
| `gardens/list-gardens` | gardens | tool | Read | `gardens:read` through older MCP auth helper | `/api/mcp/gardens/tools/call`. |
| `gardens/list-raised-beds` | gardens | tool | Read | `gardens:read`; verifies garden belongs to auth account | `/api/mcp/gardens/tools/call`. |
| `gardens/get-raised-bed-fields` | gardens | tool | Read | `gardens:read`; verifies garden belongs to auth account | `/api/mcp/gardens/tools/call`. |
| `gardens/list-operations` | gardens | tool | Read | `gardens:read`; verifies garden belongs to auth account | `/api/mcp/gardens/tools/call`. |
| `gardens/get-lifecycle-context` | gardens | tool | Read | `gardens:read`; verifies garden belongs to auth account | `/api/mcp/gardens/tools/call`. |
| `commerce/get-products` | commerce | tool | Read | `commerce:read` through older MCP auth helper | `/api/mcp/commerce/tools/call`. |
| `commerce/get-product` | commerce | tool | Read | `commerce:read` | `/api/mcp/commerce/tools/call`. |
| `commerce/search-products` | commerce | tool | Read | `commerce:read` | `/api/mcp/commerce/tools/call`. |
| `commerce/get-cart` | commerce | tool | Read | `commerce:read`; input `userId` must equal authenticated user | `/api/mcp/commerce/tools/call`. |
| `commerce/add-to-cart` | commerce | tool | Write | `commerce:purchase`; input `userId` must equal authenticated user | `/api/mcp/commerce/tools/call`. |
| `commerce/update-cart-item` | commerce | tool | Write | `commerce:purchase`; input `userId` must equal authenticated user | `/api/mcp/commerce/tools/call`. |
| `commerce-get-products` | commerce | legacy listed tool | Read | Listed by `/api/mcp/commerce`, but the call route expects slash names | `/api/mcp/commerce` tool list only. |
| `commerce-add-to-cart` | commerce | legacy listed tool | Write | Listed by `/api/mcp/commerce`, but the call route expects slash names | `/api/mcp/commerce` tool list only. |
| `gredice://directories/entity-types` | directories | resource | Read | None (`public-read`) | `/api/mcp` resources list. |
| `gredice://directories/entity-types/{entityTypeName}` | directories | resource template | Read | None (`public-read`) | `/api/mcp` resource template list. |

Verification note: the table lists every tool name found in the central catalog,
every `tools/list` block, every `availableTools` block, and every
`tools/call` switch under `apps/api/app/api/mcp`.

## Scope And Stability Questions

1. Audience: source and metadata show external-client readiness, but do not
   prove partner-facing intent. Recommended default: authenticated end-users and
   internal agents, no partner stability guarantee yet.
2. Write tools: current write-capable tools are commerce cart mutations. They
   should remain unavailable to non-admin users unless the request is
   authenticated, scoped to the current user/account, and explicitly authorized
   for purchase/write behavior. The main endpoint currently maps `user` to
   `mcp:write`, so any future `auth-mutation` central catalog tool would be
   reachable by normal users unless additional resource checks are added.
3. Versioning: the catalog should be treated as pre-contract. Names and response
   shapes may change internally until the team declares a partner-facing surface.

## Ranked Hardening Gaps

| Severity | Gap | Evidence | Fix sketch |
| --- | --- | --- | --- |
| High | Domain directory routes bypass the central catalog auth policy. | The central catalog marks all directory tools except `directories/get-plants` as `auth-read`, but `/api/mcp/directories/tools/call` and `/api/mcp/directories` inline calls execute directory tools without auth. | Route domain directory execution through the main policy layer, or apply catalog exposure checks before execution. |
| High | Rate limiting is in-process only. | `server.ts` uses `rateLimitStore = new Map(...)`; serverless instances do not share this state. | Move counters to a shared store such as Redis/Upstash, using the repo's existing cache/storage patterns. |
| High | The MCP surface has two auth models. | `/api/mcp` uses shared API JWT verification and `mcp:*` scopes; domain call routes use `GREDICE_MCP_JWT_SECRET`, a development fallback secret, and role permissions like `gardens:read`/`commerce:purchase`. | Consolidate MCP auth on one verifier, one role/scope mapping, and one account-selection path. |
| Medium | Body limits and tool timeouts apply only to the main endpoint. | `MAX_MCP_REQUEST_BODY_BYTES` and `MCP_TOOL_TIMEOUT_MS` are enforced in `handleMcpRequest`; domain-specific endpoints call `request.json()` and execute tools directly. | Extract a shared MCP request wrapper for body cap, timeout, correlation id, and policy checks. |
| Medium | Error responses can expose internal messages. | Main and domain tool handlers return `error.message` for non-Zod failures; commerce logs stacks and uses `console.error` in handlers. | Return stable public error messages plus correlation ids; keep internal details in structured logs. |
| Medium | Catalog, domain tool lists, and `apps/api/MCP_README.md` are out of sync. | Central catalog lists six directory slash-name tools; directories domain list exposes three hyphen names; commerce list exposes two hyphen names while the call route accepts six slash names; README still mentions accounts/notifications and garden mutation tools not present in source. | Make the central catalog the single source of truth, generate or test all `tools/list` responses from it, and update stale README examples. |
| Medium | Resource templates are discoverable without an observed `resources/read` handler. | `/api/mcp` implements `resources/list` and `resources/templates/list`, but no `resources/read` branch was found in `server.ts`. | Implement resource reads or hide templates until clients can dereference them. |
| Low | Protocol version constants disagree across endpoints. | `server.ts` supports `2025-03-26`; `protocol.ts` supports `2025-06-18`; both support `2024-11-05`. | Share one protocol-version module across main and domain endpoints. |

## Testability

The central catalog can be imported from `apps/api/lib/mcp` without refactoring,
so this spike adds `apps/api/lib/mcp/catalog.node.spec.ts` as a protocol-test
scaffold. It covers the currently exposed central catalog names, verifies that
domain filtering follows the catalog, and checks the static resource metadata.

Remaining testability gap: several important policies are private to
`apps/api/app/api/mcp/server.ts`, including exposure-to-scope mapping,
rate-limit behavior, timeout behavior, and auth challenge construction. Testing
those policies directly would require extracting pure helpers into `lib/mcp`,
which is out of scope for this spike.

## Follow-Up Plan Candidates

1. Move MCP rate limiting to shared Redis/Upstash counters.
2. Unify MCP auth and account selection across the main and domain endpoints.
3. Route or guard domain directory tools through the central catalog exposure
   policy.
4. Extract pure MCP policy helpers into `apps/api/lib/mcp` and add node tests
   for exposure-to-scope, rollout-stage gating, and error shapes.
5. Decide whether the MCP catalog is partner-facing. If yes, add versioning,
   contract tests, and a deprecation policy before more tools ship.
