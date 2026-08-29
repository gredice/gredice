import { z } from 'zod';

export const deliveryNativeClientId = 'gredice-delivery-android';
export const deliveryNativeRedirectUri =
    'https://dostava.gredice.com/android/auth/callback';
export const deliveryNativeAccessTokenLifetimeSeconds = 15 * 60;

export const deliveryNativeTokenRequestSchema = z
    .object({
        grant_type: z.literal('authorization_code'),
        client_id: z.literal(deliveryNativeClientId),
        redirect_uri: z.literal(deliveryNativeRedirectUri),
        code: z.string().min(1).max(256),
        code_verifier: z
            .string()
            .min(43)
            .max(128)
            .regex(/^[A-Za-z0-9._~-]+$/),
    })
    .strict();

export const deliveryNativeRefreshRequestSchema = z
    .object({
        grant_type: z.literal('refresh_token'),
        client_id: z.literal(deliveryNativeClientId),
        refresh_token: z.string().min(1).max(256),
    })
    .strict();

export const deliveryNativeRevokeRequestSchema = z
    .object({
        client_id: z.literal(deliveryNativeClientId),
        refresh_token: z.string().min(1).max(256),
    })
    .strict();

export const deliveryNativeTokenResponseSchema = z
    .object({
        access_token: z.string().min(1),
        token_type: z.literal('Bearer'),
        expires_in: z.literal(deliveryNativeAccessTokenLifetimeSeconds),
        refresh_token: z.string().min(1),
        refresh_expires_at: z.iso.datetime(),
        scope: z.literal('delivery:route:read'),
    })
    .strict();

export const deliveryNativeAuthErrorCodeSchema = z.enum([
    'ANDROID_AUTO_DISABLED',
    'AUTH_CODE_INVALID',
    'AUTH_CODE_EXPIRED',
    'AUTH_CODE_REPLAYED',
    'PKCE_MISMATCH',
    'DELIVERY_ROLE_REQUIRED',
    'ACCOUNT_NOT_ELIGIBLE',
    'REFRESH_INVALID',
    'REFRESH_REVOKED',
    'REFRESH_EXPIRED',
    'REFRESH_REPLAYED',
    'RATE_LIMITED',
    'AUTH_TEMPORARILY_UNAVAILABLE',
]);

export const deliveryNativeAuthErrorResponseSchema = z
    .object({
        error: z.string().min(1),
        code: deliveryNativeAuthErrorCodeSchema,
    })
    .strict();
