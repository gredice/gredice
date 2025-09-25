import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

type R2Config = {
    accessKeyId: string;
    secretAccessKey: string;
    endpoint: string;
    bucketName: string;
};

let cachedClient: S3Client | undefined;
let cachedConfig: R2Config | undefined;

function loadConfig(): R2Config {
    if (cachedConfig) {
        return cachedConfig;
    }

    const {
        CDN_R2_ACCESS_KEY_ID,
        CDN_R2_SECRET_ACCESS_KEY,
        CDN_R2_ENDPOINT,
        CDN_R2_BUCKET_NAME,
    } = process.env;

    if (
        !CDN_R2_ACCESS_KEY_ID ||
        !CDN_R2_SECRET_ACCESS_KEY ||
        !CDN_R2_ENDPOINT ||
        !CDN_R2_BUCKET_NAME
    ) {
        throw new Error('Missing R2 configuration environment variables');
    }

    cachedConfig = {
        accessKeyId: CDN_R2_ACCESS_KEY_ID,
        secretAccessKey: CDN_R2_SECRET_ACCESS_KEY,
        endpoint: CDN_R2_ENDPOINT,
        bucketName: CDN_R2_BUCKET_NAME,
    } satisfies R2Config;
    return cachedConfig;
}

function getClient() {
    if (cachedClient) {
        return cachedClient;
    }
    const config = loadConfig();
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

export async function uploadReceiptPdf(key: string, body: Buffer) {
    const config = loadConfig();
    const client = getClient();
    await client.send(
        new PutObjectCommand({
            Bucket: config.bucketName,
            Key: key,
            Body: body,
            ContentType: 'application/pdf',
        }),
    );
}

export async function downloadReceiptPdf(key: string) {
    const config = loadConfig();
    const client = getClient();
    const response = await client.send(
        new GetObjectCommand({
            Bucket: config.bucketName,
            Key: key,
        }),
    );
    if (!response.Body) {
        throw new Error('Receipt PDF object has no body');
    }
    const bytes = await response.Body.transformToByteArray();
    return {
        data: Buffer.from(bytes),
        contentType: response.ContentType ?? 'application/pdf',
        contentLength: response.ContentLength ?? bytes.byteLength,
    };
}
