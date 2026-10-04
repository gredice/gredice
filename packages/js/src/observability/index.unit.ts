import assert from 'node:assert/strict';
import test from 'node:test';
import {
    shouldForwardPostHogConsoleMethod,
    shouldInjectVercelAnalytics,
    shouldLogPostHogProxyRequest,
} from './index';

test('Vercel Analytics is injected only in an actual Vercel runtime', () => {
    assert.equal(shouldInjectVercelAnalytics('1'), true);
    assert.equal(shouldInjectVercelAnalytics('0'), false);
    assert.equal(shouldInjectVercelAnalytics(undefined), false);
});

test('PostHog forwards warning and error console records only', () => {
    assert.equal(shouldForwardPostHogConsoleMethod('debug'), false);
    assert.equal(shouldForwardPostHogConsoleMethod('log'), false);
    assert.equal(shouldForwardPostHogConsoleMethod('info'), false);
    assert.equal(shouldForwardPostHogConsoleMethod('warn'), true);
    assert.equal(shouldForwardPostHogConsoleMethod('error'), true);
});

test('PostHog ingest traffic does not log telemetry about itself', () => {
    assert.equal(
        shouldLogPostHogProxyRequest({
            pathname: '/ingest',
            proxyResult: 'rewrite',
        }),
        false,
    );
    assert.equal(
        shouldLogPostHogProxyRequest({
            pathname: '/ingest/e',
            proxyResult: 'rewrite',
        }),
        false,
    );
});

test('routine proxy requests are omitted while redirects and rewrites remain visible', () => {
    assert.equal(
        shouldLogPostHogProxyRequest({
            pathname: '/biljke/rajcica',
            proxyResult: 'next',
        }),
        false,
    );
    assert.equal(
        shouldLogPostHogProxyRequest({
            pathname: '/biljke/Rajcica',
            proxyResult: 'redirect',
        }),
        true,
    );
    assert.equal(
        shouldLogPostHogProxyRequest({
            pathname: '/legacy',
            proxyResult: 'rewrite',
        }),
        true,
    );
});

test('public MCP requests retain explicit request logging', () => {
    assert.equal(
        shouldLogPostHogProxyRequest({
            pathname: '/api/mcp',
            proxyResult: 'next',
        }),
        true,
    );
    assert.equal(
        shouldLogPostHogProxyRequest({
            pathname: '/api/mcp/tools',
            proxyResult: 'next',
        }),
        true,
    );
    assert.equal(
        shouldLogPostHogProxyRequest({
            pathname: '/api/mcproxy',
            proxyResult: 'next',
        }),
        false,
    );
});
