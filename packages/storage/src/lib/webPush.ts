import 'server-only';
import {
    createCipheriv,
    createECDH,
    createPrivateKey,
    createSign,
    hkdfSync,
    type KeyObject,
    randomBytes,
} from 'node:crypto';

function base64UrlEncode(buffer: Buffer) {
    return buffer
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function base64UrlDecode(value: string) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding =
        normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
    return Buffer.from(normalized + '='.repeat(padding), 'base64');
}

type VapidConfig = {
    publicKey: string;
    publicKeyBuffer: Buffer;
    privateKey: KeyObject;
    subject: string;
};

let cachedVapidConfig: VapidConfig | null | undefined;

function getVapidConfig() {
    if (cachedVapidConfig !== undefined) {
        return cachedVapidConfig;
    }

    const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
    const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
    const contact = process.env.WEB_PUSH_CONTACT_EMAIL;

    if (!publicKey || !privateKey || !contact) {
        cachedVapidConfig = null;
        return null;
    }

    try {
        const publicKeyBuffer = base64UrlDecode(publicKey);
        const privateKeyBuffer = base64UrlDecode(privateKey);

        if (publicKeyBuffer.length !== 65 || privateKeyBuffer.length !== 32) {
            console.error('Invalid VAPID key lengths.');
            cachedVapidConfig = null;
            return null;
        }

        const pkcs8Header = Buffer.from('302e0201010420', 'hex');
        const pkcs8Footer = Buffer.from('a00706052b8104000a', 'hex');
        const pkcs8Key = Buffer.concat([
            pkcs8Header,
            privateKeyBuffer,
            pkcs8Footer,
        ]);

        cachedVapidConfig = {
            publicKey,
            publicKeyBuffer,
            privateKey: createPrivateKey({
                key: pkcs8Key,
                type: 'pkcs8',
                format: 'der',
            }),
            subject: contact.startsWith('mailto:')
                ? contact
                : `mailto:${contact}`,
        };

        return cachedVapidConfig;
    } catch (error) {
        console.error('Failed to initialize VAPID configuration', error);
        cachedVapidConfig = null;
        return null;
    }
}

function readLength(buffer: Buffer, offset: number) {
    const initial = buffer[offset];
    if (initial < 0x80) {
        return { length: initial, bytes: 1 };
    }
    const bytes = initial & 0x7f;
    let length = 0;
    for (let i = 0; i < bytes; i++) {
        length = (length << 8) | buffer[offset + 1 + i];
    }
    return { length, bytes: 1 + bytes };
}

function trimLeadingZeros(buffer: Buffer) {
    let index = 0;
    while (index < buffer.length - 1 && buffer[index] === 0) {
        index++;
    }
    return buffer.slice(index);
}

function derToJoseSignature(signature: Buffer) {
    let offset = 0;
    if (signature[offset++] !== 0x30) {
        throw new Error('Invalid DER signature.');
    }
    const seqInfo = readLength(signature, offset);
    offset += seqInfo.bytes;

    if (signature[offset++] !== 0x02) {
        throw new Error('Invalid DER signature.');
    }
    const rInfo = readLength(signature, offset);
    offset += rInfo.bytes;
    let r = signature.slice(offset, offset + rInfo.length);
    offset += rInfo.length;

    if (signature[offset++] !== 0x02) {
        throw new Error('Invalid DER signature.');
    }
    const sInfo = readLength(signature, offset);
    offset += sInfo.bytes;
    let s = signature.slice(offset, offset + sInfo.length);

    r = trimLeadingZeros(r);
    s = trimLeadingZeros(s);

    if (r.length > 32 || s.length > 32) {
        throw new Error('Invalid ECDSA signature length.');
    }

    const rPadded = Buffer.concat([Buffer.alloc(32 - r.length), r]);
    const sPadded = Buffer.concat([Buffer.alloc(32 - s.length), s]);

    return base64UrlEncode(Buffer.concat([rPadded, sPadded]));
}

function createContext(clientPublicKey: Buffer, serverPublicKey: Buffer) {
    const context = Buffer.alloc(
        1 + 2 + clientPublicKey.length + 2 + serverPublicKey.length,
    );
    let offset = 0;
    context.writeUInt8(0, offset);
    offset += 1;
    context.writeUInt16BE(clientPublicKey.length, offset);
    offset += 2;
    clientPublicKey.copy(context, offset);
    offset += clientPublicKey.length;
    context.writeUInt16BE(serverPublicKey.length, offset);
    offset += 2;
    serverPublicKey.copy(context, offset);
    return context;
}

function createVapidJwt(endpoint: string, vapid: VapidConfig) {
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const expiration = Math.floor((Date.now() + 12 * 60 * 60 * 1000) / 1000);

    const header = base64UrlEncode(
        Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })),
    );
    const payload = base64UrlEncode(
        Buffer.from(
            JSON.stringify({
                aud: audience,
                exp: expiration,
                sub: vapid.subject,
            }),
        ),
    );

    const data = `${header}.${payload}`;
    const signer = createSign('SHA256');
    signer.update(data);
    signer.end();
    const signatureDer = signer.sign(vapid.privateKey);
    const signature = derToJoseSignature(signatureDer);
    return `${data}.${signature}`;
}

export type WebPushPayload = {
    title: string;
    body?: string;
    icon?: string | null;
    image?: string | null;
    url?: string | null;
    data?: Record<string, unknown>;
};

export type WebPushResult =
    | { status: 'not-configured' }
    | { status: 'invalid-subscription' }
    | { status: 'unsubscribed' }
    | { status: 'success' }
    | { status: 'error'; statusCode?: number; body?: string };

export async function sendWebPush(
    subscription: {
        endpoint: string;
        auth: string;
        p256dh: string;
    },
    payload: WebPushPayload,
): Promise<WebPushResult> {
    const vapid = getVapidConfig();
    if (!vapid) {
        return { status: 'not-configured' };
    }

    let clientPublicKey: Buffer;
    let authSecret: Buffer;
    try {
        clientPublicKey = base64UrlDecode(subscription.p256dh);
        authSecret = base64UrlDecode(subscription.auth);
    } catch (error) {
        console.error('Failed to decode push subscription keys', error);
        return { status: 'invalid-subscription' };
    }

    if (clientPublicKey.length !== 65 || authSecret.length === 0) {
        return { status: 'invalid-subscription' };
    }

    const salt = randomBytes(16);
    const serverKeys = createECDH('prime256v1');
    const serverPublicKey = serverKeys.generateKeys();

    let sharedSecret: Buffer;
    try {
        sharedSecret = serverKeys.computeSecret(clientPublicKey);
    } catch (error) {
        console.error('Failed to compute shared secret for web push', error);
        return { status: 'invalid-subscription' };
    }

    const prk = hkdfSync(
        'sha256',
        sharedSecret,
        authSecret,
        Buffer.from('Content-Encoding: auth\u0000'),
        32,
    );

    const context = createContext(clientPublicKey, serverPublicKey);

    const contentEncryptionKey = hkdfSync(
        'sha256',
        prk,
        salt,
        Buffer.concat([
            Buffer.from('Content-Encoding: aes128gcm\u0000'),
            context,
        ]),
        16,
    );

    const nonce = hkdfSync(
        'sha256',
        prk,
        salt,
        Buffer.concat([Buffer.from('Content-Encoding: nonce\u0000'), context]),
        12,
    );

    const bodyPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon ?? undefined,
        image: payload.image ?? undefined,
        url: payload.url ?? undefined,
        data: payload.data,
    });

    const record = Buffer.concat([
        Buffer.alloc(2),
        Buffer.from(bodyPayload, 'utf8'),
    ]);

    const cipher = createCipheriv('aes-128-gcm', contentEncryptionKey, nonce);
    const encrypted = Buffer.concat([cipher.update(record), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const requestBody = Buffer.concat([encrypted, authTag]);

    const authorization = `WebPush ${createVapidJwt(subscription.endpoint, vapid)}`;
    const cryptoKeyHeader = `dh=${base64UrlEncode(serverPublicKey)};p256ecdsa=${vapid.publicKey}`;
    const encryptionHeader = `salt=${base64UrlEncode(salt)}`;

    try {
        const response = await fetch(subscription.endpoint, {
            method: 'POST',
            headers: {
                TTL: '2419200',
                'Content-Encoding': 'aes128gcm',
                'Content-Type': 'application/octet-stream',
                Authorization: authorization,
                'Crypto-Key': cryptoKeyHeader,
                Encryption: encryptionHeader,
            },
            body: requestBody,
        });

        if (response.status === 404 || response.status === 410) {
            return { status: 'unsubscribed' };
        }

        if (response.status >= 400) {
            const responseBody = await response.text();
            console.error(
                `Web push request failed with status ${response.status}: ${responseBody}`,
            );
            return {
                status: 'error',
                statusCode: response.status,
                body: responseBody,
            };
        }

        return { status: 'success' };
    } catch (error) {
        console.error('Failed to send web push notification', error);
        return { status: 'error' };
    }
}
