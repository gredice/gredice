'use client';

import { useMemo, useState } from 'react';

export type McpConsoleRequest = {
    key: string;
    label: string;
    description: string;
    requiresAuth: boolean;
    payload: Record<string, unknown>;
};

type ConsoleResult = {
    status: number;
    statusText: string;
    authenticateHeader: string | null;
    body: unknown;
    elapsedMs: number;
};

function isJsonObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatJson(value: unknown) {
    return JSON.stringify(value, null, 2);
}

export function McpTestConsole({
    requests,
}: {
    requests: McpConsoleRequest[];
}) {
    const initialRequest = requests[0] ?? null;
    const [selectedKey, setSelectedKey] = useState(initialRequest?.key ?? '');
    const [requestBody, setRequestBody] = useState(
        initialRequest ? formatJson(initialRequest.payload) : '{}',
    );
    const [bearerToken, setBearerToken] = useState('');
    const [accountId, setAccountId] = useState('');
    const [result, setResult] = useState<ConsoleResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    const selectedRequest = useMemo(
        () =>
            requests.find((request) => request.key === selectedKey) ??
            initialRequest,
        [initialRequest, requests, selectedKey],
    );

    function selectRequest(request: McpConsoleRequest) {
        setSelectedKey(request.key);
        setRequestBody(formatJson(request.payload));
        setError(null);
        setResult(null);
    }

    async function runRequest() {
        setIsRunning(true);
        setError(null);
        setResult(null);

        try {
            const parsed: unknown = JSON.parse(requestBody);
            if (!isJsonObject(parsed)) {
                throw new Error('Request body must be a JSON object.');
            }

            const headers = new Headers();
            headers.set('content-type', 'application/json');

            const token = bearerToken.trim();
            if (token) {
                headers.set('authorization', `Bearer ${token}`);
            }

            const selectedAccountId = accountId.trim();
            if (selectedAccountId) {
                headers.set('x-gredice-account-id', selectedAccountId);
            }

            const startedAt = performance.now();
            const response = await fetch('/api/mcp', {
                method: 'POST',
                headers,
                body: JSON.stringify(parsed),
            });
            const elapsedMs = Math.round(performance.now() - startedAt);
            const text = await response.text();

            let body: unknown = text;
            if (text) {
                try {
                    body = JSON.parse(text);
                } catch {
                    body = text;
                }
            }

            setResult({
                status: response.status,
                statusText: response.statusText,
                authenticateHeader: response.headers.get('www-authenticate'),
                body,
                elapsedMs,
            });
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : 'Request failed.',
            );
        } finally {
            setIsRunning(false);
        }
    }

    return (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-md border border-border bg-card p-3">
                <div className="space-y-2">
                    {requests.map((request) => (
                        <button
                            className={`w-full rounded-md border px-3 py-2 text-left transition ${
                                request.key === selectedKey
                                    ? 'border-blue-500 bg-blue-50 text-blue-950 dark:bg-blue-950 dark:text-blue-50'
                                    : 'border-border bg-background hover:bg-secondary'
                            }`}
                            key={request.key}
                            onClick={() => selectRequest(request)}
                            type="button"
                        >
                            <span className="block text-sm font-medium">
                                {request.label}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                                {request.description}
                            </span>
                            <span className="mt-2 inline-flex rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide">
                                {request.requiresAuth
                                    ? 'Bearer token'
                                    : 'No token'}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="rounded-md border border-border bg-card p-4">
                <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium">
                        Bearer token
                        <input
                            autoComplete="off"
                            className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm font-normal outline-hidden focus:ring-2 focus:ring-ring"
                            onChange={(event) =>
                                setBearerToken(event.currentTarget.value)
                            }
                            placeholder="Paste a gredice_session value or API JWT"
                            type="password"
                            value={bearerToken}
                        />
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                        Account ID
                        <input
                            autoComplete="off"
                            className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm font-normal outline-hidden focus:ring-2 focus:ring-ring"
                            onChange={(event) =>
                                setAccountId(event.currentTarget.value)
                            }
                            placeholder="Optional x-gredice-account-id"
                            type="text"
                            value={accountId}
                        />
                    </label>
                </div>

                <div className="mt-4 grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold">
                                {selectedRequest?.label ?? 'Request'}
                            </h2>
                            {selectedRequest ? (
                                <p className="text-sm text-muted-foreground">
                                    {selectedRequest.description}
                                </p>
                            ) : null}
                        </div>
                        <button
                            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isRunning}
                            onClick={runRequest}
                            type="button"
                        >
                            {isRunning ? 'Running' : 'Run'}
                        </button>
                    </div>
                    <textarea
                        className="min-h-[260px] resize-y rounded-md border border-input bg-background p-3 font-mono text-sm outline-hidden focus:ring-2 focus:ring-ring"
                        onChange={(event) =>
                            setRequestBody(event.currentTarget.value)
                        }
                        spellCheck={false}
                        value={requestBody}
                    />
                </div>

                {error ? (
                    <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
                        {error}
                    </div>
                ) : null}

                {result ? (
                    <div className="mt-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                            <span className="rounded-full border border-border px-2 py-0.5 font-mono">
                                HTTP {result.status} {result.statusText}
                            </span>
                            <span className="rounded-full border border-border px-2 py-0.5 font-mono">
                                {result.elapsedMs}ms
                            </span>
                        </div>
                        <pre className="max-h-[420px] overflow-auto rounded-md border border-border bg-slate-950 p-3 text-xs leading-relaxed text-slate-50">
                            {formatJson({
                                wwwAuthenticate: result.authenticateHeader,
                                body: result.body,
                            })}
                        </pre>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
