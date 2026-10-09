# Neon pool disconnect investigation

## Production evidence

The October 9, 2026 Vercel review captured seven `storage.neon.pool.error`
records at 01:22:33.298–01:22:33.301 UTC during one successful
`GET /api/gardens/177/public` (HTTP 200). The deployment was
`dpl_6V7XDai1vWLocDdjs7kzafn2V87t`, commit
`5f10830e416a0e386433337252ecb12f758a7ea8`, region `fra1`, runtime
`nodejs24.x`. Every record had `error.kind=error-event`, no code, and
`totalCount=idleCount=waitingCount=0`. The same signature had appeared in API
and News on October 7.

Source evidence: local review artifacts
`/Users/aleks/.codex/automations/gredice-vercel-review/runs/2026-10-09/report.json`
and `evidence.json`. No customer payloads or credentials are copied here.
Seven records are not evidence of seven failed queries or a customer outage.

## Transport and lifecycle

Storage previously supplied no WebSocket constructor. The installed Neon
1.2.0 driver therefore selected Node 24's global WebSocket (Undici).
The pool removes an idle client from its accounting **before** calling
`Client.end()`. Ending the client sends PostgreSQL's Terminate message. If the
peer then ends TCP without completing a WebSocket close handshake, native
WebSocket emits an `ErrorEvent` wrapping a code-less `TypeError`. Neon forwards
that event through its socket and client even when the client is already ending;
the still-attached pool idle listener consequently reports an error for a
connection already removed from the pool.

This is the mechanism behind the otherwise misleading zero-count diagnostics.
The behavior is also described in [Undici issue #4625](https://github.com/nodejs/undici/issues/4625).
Neon supports [selecting a constructor per client](https://github.com/neondatabase/serverless/blob/main/CONFIG.md)
and [using `ws` with its Node driver](https://github.com/neondatabase/serverless/blob/main/README.md).

The isolated loopback fixture uses the real Neon driver and pool, real
WebSocket connections, and a minimal PostgreSQL peer. It answers startup and
simple queries, and ends TCP upon Terminate without a WebSocket close handshake.
Evicting seven idle clients with native WebSocket reproduces seven pool errors
with precisely the recorded kind, absent code, and zero counts. The regression
fails against the old storage transport and passes with the targeted change.

The retained production diagnostics intentionally omit raw messages, socket
state, and close details. They cannot retrospectively establish whether the
original closure came from Neon, a proxy, a network interruption, or runtime
suspension. The local reproduction establishes the transport/lifecycle mechanism
and a matching signature, rather than proving the exact remote trigger.

## Targeted change and validation

Storage uses a Neon Client subclass that selects the pinned `ws` constructor
on the individual client. The subclass is assigned to the pool's public `Client`
property before acquisition: Neon 1.2.0 overrides the constructor's `Client`
option, so passing only `PoolConfig.Client` would silently leave native transport
in place. Global WebSocket and global Neon defaults remain unchanged.

`ws` reports closure to the driver without the native transport's synthetic
error on local teardown. The driver still distinguishes intentional end from
unexpected loss. No diagnostic filtering, pool reset, query interception, new
retry policy, or timeout change is introduced. Existing diagnostic allowlists
and read retry limits remain intact.

Run the isolated regressions from the repository root:

```sh
pnpm --filter @gredice/storage exec node --import tsx --test --conditions=react-server tests/neonStoragePool.node.spec.ts
```

The transport regression compares native teardown with production storage,
confirms seven intentional idle removals produce no error logs, checks that
unexpected idle peer loss still produces sanitized diagnostics, and verifies
active transport loss rejects its query and permits a replacement connection.
The existing driver lifecycle fixture also covers constructor selection,
singleton/listener reuse, connection acquisition rejection, original active
error identity, query error causes, transaction rollback/commit, bounded read
retry, and close/recreate behavior. The diagnostics tests guard against leaking
URLs, credentials, SQL, messages, stacks, clients, and causes.

Loopback tests establish driver behavior, not production transport stability.
After the change reaches production, compare subsequent API and News logs for
this signature while continuing to investigate any real disconnect events.
