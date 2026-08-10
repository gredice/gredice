import assert from 'node:assert/strict';
import test from 'node:test';
import {
    addPublicOgSignature,
    resolvePublicOgSigningConfig,
    verifyPublicOgSignature,
} from './publicOgSignature.ts';

const signingConfig = {
    secret: 'test-preview-secret',
    allowUnsigned: false,
    configurationValid: true,
} as const;
const localUnsignedConfig = {
    allowUnsigned: true,
    configurationValid: true,
} as const;

function canonicalCardQuery() {
    return new URLSearchParams({
        title: 'Biljke',
        description: 'Istraži biljke u Gredicama.',
        eyebrow: 'Katalog biljaka',
    });
}

test('accepts a valid domain-separated public OG signature', () => {
    const canonical = canonicalCardQuery();
    const signed = addPublicOgSignature(canonical, signingConfig);

    assert.equal(
        verifyPublicOgSignature(signed.toString(), canonical, signingConfig),
        'valid',
    );
    assert.match(signed.get('sig') ?? '', /^[A-Za-z0-9_-]{43}$/);
});

test('rejects a tampered signed card query', () => {
    const canonical = canonicalCardQuery();
    const signed = addPublicOgSignature(canonical, signingConfig);
    const tamperedCanonical = canonicalCardQuery();
    tamperedCanonical.set('title', 'Drugi naslov');
    signed.set('title', 'Drugi naslov');

    assert.equal(
        verifyPublicOgSignature(
            signed.toString(),
            tamperedCanonical,
            signingConfig,
        ),
        'invalid-signature',
    );
});

test('rejects equivalent noncanonical raw query encodings', () => {
    const canonical = canonicalCardQuery();
    const signed = addPublicOgSignature(canonical, signingConfig);
    const noncanonicalRawQuery = signed
        .toString()
        .replace('title=Biljke', 'title=%42iljke');
    const requestUrl = new URL(
        `https://www.gredice.com/api/og/public?${noncanonicalRawQuery}`,
    );

    assert.equal(requestUrl.search.slice(1), noncanonicalRawQuery);
    assert.equal(
        verifyPublicOgSignature(
            requestUrl.search.slice(1),
            canonical,
            signingConfig,
        ),
        'noncanonical-query',
    );
});

test('rejects a missing signature when a secret is configured', () => {
    const canonical = canonicalCardQuery();

    assert.equal(
        verifyPublicOgSignature(canonical.toString(), canonical, signingConfig),
        'missing-signature',
    );
});

test('allows unsigned cards only for explicit local/test configuration', () => {
    const canonical = canonicalCardQuery();

    assert.equal(
        verifyPublicOgSignature(
            canonical.toString(),
            canonical,
            localUnsignedConfig,
        ),
        'unsigned-local',
    );
    assert.deepEqual(resolvePublicOgSigningConfig({}), localUnsignedConfig);
    assert.deepEqual(resolvePublicOgSigningConfig({ NODE_ENV: 'test' }), {
        allowUnsigned: true,
        configurationValid: true,
    });
});

test('fails closed when a deployment or CI environment lacks the secret', () => {
    const invalidConfig = {
        allowUnsigned: false,
        configurationValid: false,
    } as const;

    assert.deepEqual(resolvePublicOgSigningConfig({ VERCEL_ENV: 'preview' }), {
        allowUnsigned: false,
        configurationValid: false,
    });
    assert.deepEqual(resolvePublicOgSigningConfig({ CI: 'true' }), {
        allowUnsigned: false,
        configurationValid: false,
    });
    assert.deepEqual(
        resolvePublicOgSigningConfig({ CI: 'true', NODE_ENV: 'test' }),
        {
            allowUnsigned: false,
            configurationValid: false,
        },
    );
    assert.throws(
        () => addPublicOgSignature(canonicalCardQuery(), invalidConfig),
        /CMS_PAGES_PREVIEW_SECRET/,
    );
    assert.equal(
        verifyPublicOgSignature(
            canonicalCardQuery().toString(),
            canonicalCardQuery(),
            invalidConfig,
        ),
        'configuration-error',
    );
});
