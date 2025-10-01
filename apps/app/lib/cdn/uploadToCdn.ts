'use server';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

interface R2Config {
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    endpoint: string;
    publicUrl: string;
}

let cachedConfig: R2Config | null = null;
let cachedClient: S3Client | null = null;

function resolveConfig(): R2Config {
    if (cachedConfig) {
        return cachedConfig;
    }

    const {
        CDN_R2_ACCESS_KEY_ID,
        CDN_R2_SECRET_ACCESS_KEY,
        CDN_R2_BUCKET_NAME,
        CDN_R2_ENDPOINT,
        CDN_R2_PUBLIC_URL,
    } = process.env;

    if (
        !CDN_R2_ACCESS_KEY_ID ||
        !CDN_R2_SECRET_ACCESS_KEY ||
        !CDN_R2_BUCKET_NAME ||
        !CDN_R2_ENDPOINT ||
        !CDN_R2_PUBLIC_URL
    ) {
        throw new Error('R2 configuration is missing');
    }

    cachedConfig = {
        accessKeyId: CDN_R2_ACCESS_KEY_ID,
        secretAccessKey: CDN_R2_SECRET_ACCESS_KEY,
        bucketName: CDN_R2_BUCKET_NAME,
        endpoint: CDN_R2_ENDPOINT,
        publicUrl: CDN_R2_PUBLIC_URL,
    };

    return cachedConfig;
}

function getClient(): S3Client {
    if (cachedClient) {
        return cachedClient;
    }

    const config = resolveConfig();

    cachedClient = new S3Client({
        region: 'auto',
        endpoint: config.endpoint,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    });

    return cachedClient;
}

function buildPublicUrl(key: string, baseUrl: string): string {
    const trimmedBase = baseUrl.replace(/\/$/, '');
    const normalizedKey = key.replace(/^\/+/, '');
    return `${trimmedBase}/${normalizedKey}`;
}

export type UploadBody = Blob | ArrayBuffer | ArrayBufferView | Buffer;

async function toBuffer(data: UploadBody): Promise<Buffer> {
    if (data instanceof Buffer) {
        return data;
    }

    if (ArrayBuffer.isView(data)) {
        return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    }

    if (data instanceof ArrayBuffer) {
        return Buffer.from(data);
    }

    const maybeBlob = data as Blob;
    if (typeof maybeBlob.arrayBuffer === 'function') {
        const arrayBuffer = await maybeBlob.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    throw new Error('Unsupported upload data type for CDN.');
}

export interface UploadToCdnOptions {
    key: string;
    data: UploadBody;
    contentType?: string | null;
    cacheControl?: string;
}

export async function uploadToCdn({
    key,
    data,
    contentType,
    cacheControl,
}: UploadToCdnOptions): Promise<{ key: string; url: string }> {
    if (!key || key.trim().length === 0) {
        throw new Error('Upload key is required.');
    }

    const config = resolveConfig();
    const client = getClient();
    const body = await toBuffer(data);
    const normalizedKey = key.replace(/^\/+/, '');

    await client.send(
        new PutObjectCommand({
            Bucket: config.bucketName,
            Key: normalizedKey,
            Body: body,
            ContentType: contentType ?? undefined,
            CacheControl: cacheControl,
        }),
    );

    return {
        key: normalizedKey,
        url: buildPublicUrl(normalizedKey, config.publicUrl),
    };
}

export function getCdnPublicUrl(key: string): string {
    const config = resolveConfig();
    return buildPublicUrl(key, config.publicUrl);
}
