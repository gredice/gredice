import { createHmac } from 'node:crypto';
import type { Page } from '@playwright/test';

const deliveryQualitySecretValue = 'delivery-quality-4146-test-secret-material';
export const deliveryQualityJwtSignSecret = Buffer.from(
    deliveryQualitySecretValue,
).toString('base64');

function encodeJwtPart(value: Record<string, unknown>) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createDeliveryTestJwt({
    role,
    userId,
}: {
    role: 'admin' | 'driver' | 'user';
    userId: string;
}) {
    const issuedAt = Math.floor(Date.now() / 1_000);
    const signingInput = [
        encodeJwtPart({ alg: 'HS256' }),
        encodeJwtPart({
            aud: 'urn:gredice:audience:web',
            exp: issuedAt + 60 * 60,
            gredice: {
                accountIds: ['account-delivery-quality-4146'],
                role,
                userName: `Test ${role}`,
            },
            iat: issuedAt,
            iss: 'urn:gredice:issuer:api',
            sub: userId,
        }),
    ].join('.');
    const signature = createHmac(
        'sha256',
        Buffer.from(deliveryQualityJwtSignSecret, 'base64'),
    )
        .update(signingInput)
        .digest('base64url');
    return `${signingInput}.${signature}`;
}

export async function installDeliveryTestSession({
    baseURL,
    page,
    role,
    userId,
}: {
    baseURL: string;
    page: Page;
    role: 'admin' | 'driver' | 'user';
    userId: string;
}) {
    await page.context().addCookies([
        {
            name: 'gredice_session',
            value: createDeliveryTestJwt({ role, userId }),
            url: baseURL,
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
}
