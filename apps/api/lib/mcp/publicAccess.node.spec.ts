import assert from 'node:assert/strict';
import test from 'node:test';
import {
    canCallProtectedMcpToolWhilePublicAccessIsDisabled,
    isLegacyMcpPath,
    isMcpPublicAccessEnabled,
    mcpPublicAccessFlagName,
    parseMcpPublicAccessFlag,
} from './publicAccess';

function withPublicAccessFlag(value: string | undefined, callback: () => void) {
    const previousValue = process.env[mcpPublicAccessFlagName];

    if (typeof value === 'string') {
        process.env[mcpPublicAccessFlagName] = value;
    } else {
        delete process.env[mcpPublicAccessFlagName];
    }

    try {
        callback();
    } finally {
        if (typeof previousValue === 'string') {
            process.env[mcpPublicAccessFlagName] = previousValue;
        } else {
            delete process.env[mcpPublicAccessFlagName];
        }
    }
}

test('MCP public access is fail-closed unless explicitly enabled', () => {
    for (const value of [undefined, '', '0', 'false', 'off', 'invalid']) {
        assert.equal(parseMcpPublicAccessFlag(value), false);
    }
    for (const value of ['1', 'true', 'TRUE', 'yes', 'on', 'enabled']) {
        assert.equal(parseMcpPublicAccessFlag(value), true);
    }

    withPublicAccessFlag(undefined, () => {
        assert.equal(isMcpPublicAccessEnabled(), false);
    });
    withPublicAccessFlag('true', () => {
        assert.equal(isMcpPublicAccessEnabled(), true);
    });
});

test('legacy domain-specific MCP paths stay outside the public surface', () => {
    assert.equal(isLegacyMcpPath('/api/mcp/directories'), true);
    assert.equal(isLegacyMcpPath('/api/mcp/gardens/tools/call'), true);
    assert.equal(isLegacyMcpPath('/api/mcp/commerce'), true);
    assert.equal(isLegacyMcpPath('/api/mcp/core/health'), true);
    assert.equal(isLegacyMcpPath('/api/mcp'), false);
    assert.equal(
        isLegacyMcpPath('/api/mcp/.well-known/oauth-protected-resource'),
        false,
    );
});

test('disabled public access preserves only bearer-authenticated protected tool calls', () => {
    assert.equal(
        canCallProtectedMcpToolWhilePublicAccessIsDisabled({
            authorization: 'Bearer internal-token',
            exposure: 'auth-read',
            method: 'tools/call',
        }),
        true,
    );
    assert.equal(
        canCallProtectedMcpToolWhilePublicAccessIsDisabled({
            authorization: 'Bearer internal-token',
            exposure: 'auth-mutation',
            method: 'tools/call',
        }),
        true,
    );
    assert.equal(
        canCallProtectedMcpToolWhilePublicAccessIsDisabled({
            authorization: 'Bearer internal-token',
            exposure: 'public-read',
            method: 'tools/call',
        }),
        false,
    );
    assert.equal(
        canCallProtectedMcpToolWhilePublicAccessIsDisabled({
            authorization: null,
            exposure: 'auth-read',
            method: 'tools/call',
        }),
        false,
    );
    assert.equal(
        canCallProtectedMcpToolWhilePublicAccessIsDisabled({
            authorization: 'Bearer internal-token',
            exposure: 'auth-read',
            method: 'initialize',
        }),
        false,
    );
});
