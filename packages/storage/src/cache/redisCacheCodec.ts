import {
    brotliCompressSync,
    brotliDecompressSync,
    constants as zlibConstants,
} from 'node:zlib';

const CACHE_DATE_KEY = '__grediceCacheDate';
const PLAIN_CACHE_ENVELOPE_VERSION = 'v1';
const BROTLI_CACHE_ENVELOPE_VERSION = 'v1-br';
const BROTLI_QUALITY = 4;

export const DEFAULT_MAX_UNCOMPRESSED_CACHE_BYTES = 16 * 1024 * 1024;

type PlainRedisCacheEnvelope = {
    __grediceCacheEnvelope: typeof PLAIN_CACHE_ENVELOPE_VERSION;
    value: unknown;
};

type BrotliRedisCacheEnvelope = {
    __grediceCacheEnvelope: typeof BROTLI_CACHE_ENVELOPE_VERSION;
    value: string;
};

export type RedisCacheEnvelope =
    | PlainRedisCacheEnvelope
    | BrotliRedisCacheEnvelope;

export type EncodedRedisCacheValue = {
    cacheValue: RedisCacheEnvelope | null;
    encoding: 'plain' | 'brotli' | null;
    sourceBytes: number;
    storedBytes: number | null;
};

export type DecodedRedisCacheValue =
    | { hit: true; value: unknown }
    | { hit: false };

type EncodeRedisCacheValueOptions = {
    maxStoredBytes: number;
    maxUncompressedBytes?: number;
};

type DecodeRedisCacheValueOptions = {
    maxUncompressedBytes?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function serializeCacheValue(value: unknown): unknown {
    if (value instanceof Date) {
        return {
            [CACHE_DATE_KEY]: value.toISOString(),
        };
    }

    if (Array.isArray(value)) {
        return value.map(serializeCacheValue);
    }

    if (!isRecord(value)) {
        return value;
    }

    const serialized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        serialized[key] = serializeCacheValue(item);
    }
    return serialized;
}

function deserializeCacheValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(deserializeCacheValue);
    }

    if (!isRecord(value)) {
        return value;
    }

    const dateValue = value[CACHE_DATE_KEY];
    if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        return Number.isNaN(date.getTime()) ? dateValue : date;
    }

    const deserialized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        deserialized[key] = deserializeCacheValue(item);
    }
    return deserialized;
}

function isPlainCacheEnvelope(
    value: unknown,
): value is PlainRedisCacheEnvelope {
    return (
        isRecord(value) &&
        value.__grediceCacheEnvelope === PLAIN_CACHE_ENVELOPE_VERSION &&
        'value' in value
    );
}

function isBrotliCacheEnvelope(
    value: unknown,
): value is BrotliRedisCacheEnvelope {
    return (
        isRecord(value) &&
        value.__grediceCacheEnvelope === BROTLI_CACHE_ENVELOPE_VERSION &&
        typeof value.value === 'string'
    );
}

export function encodeRedisCacheValue(
    value: unknown,
    options: EncodeRedisCacheValueOptions,
): EncodedRedisCacheValue {
    const serializedValue = serializeCacheValue(value);
    const plainEnvelope: PlainRedisCacheEnvelope = {
        __grediceCacheEnvelope: PLAIN_CACHE_ENVELOPE_VERSION,
        value: serializedValue,
    };
    const plainPayload = JSON.stringify(plainEnvelope);
    const sourceBytes = Buffer.byteLength(plainPayload);

    if (sourceBytes <= options.maxStoredBytes) {
        return {
            cacheValue: plainEnvelope,
            encoding: 'plain',
            sourceBytes,
            storedBytes: sourceBytes,
        };
    }

    const maxUncompressedBytes =
        options.maxUncompressedBytes ?? DEFAULT_MAX_UNCOMPRESSED_CACHE_BYTES;
    if (sourceBytes > maxUncompressedBytes) {
        return {
            cacheValue: null,
            encoding: null,
            sourceBytes,
            storedBytes: null,
        };
    }

    const compressedValue = brotliCompressSync(
        Buffer.from(JSON.stringify(serializedValue)),
        {
            params: {
                [zlibConstants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
            },
        },
    ).toString('base64');
    const compressedEnvelope: BrotliRedisCacheEnvelope = {
        __grediceCacheEnvelope: BROTLI_CACHE_ENVELOPE_VERSION,
        value: compressedValue,
    };
    const storedBytes = Buffer.byteLength(JSON.stringify(compressedEnvelope));

    return {
        cacheValue:
            storedBytes <= options.maxStoredBytes ? compressedEnvelope : null,
        encoding: storedBytes <= options.maxStoredBytes ? 'brotli' : null,
        sourceBytes,
        storedBytes,
    };
}

export function decodeRedisCacheValue(
    value: unknown,
    options: DecodeRedisCacheValueOptions = {},
): DecodedRedisCacheValue {
    if (isPlainCacheEnvelope(value)) {
        return {
            hit: true,
            value: deserializeCacheValue(value.value),
        };
    }

    if (!isBrotliCacheEnvelope(value)) {
        return { hit: false };
    }

    const decompressed = brotliDecompressSync(
        Buffer.from(value.value, 'base64'),
        {
            maxOutputLength:
                options.maxUncompressedBytes ??
                DEFAULT_MAX_UNCOMPRESSED_CACHE_BYTES,
        },
    );
    return {
        hit: true,
        value: deserializeCacheValue(
            JSON.parse(decompressed.toString('utf8')) as unknown,
        ),
    };
}
