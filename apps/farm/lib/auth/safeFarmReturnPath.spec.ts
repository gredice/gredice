import { expect, test } from '@playwright/test';
import {
    getFarmOAuthStartUrl,
    getSafeFarmReturnPath,
} from './safeFarmReturnPath';

test('keeps supported Farm routes with their query and hash intact', () => {
    for (const returnTo of [
        '/',
        '/schedule?date=2026-07-15&view=day#task-18',
        '/notifications?filter=unread',
        '/raised-beds/42#operations',
        '/operations/7?source=notification',
        '/plants/337',
        '/greenhouse',
        '/more',
        '/payouts',
        '/settings',
    ]) {
        expect(getSafeFarmReturnPath(returnTo)).toBe(returnTo);
    }
});

test('falls back for external, malformed, private, and unsupported targets', () => {
    for (const returnTo of [
        null,
        '',
        ' /schedule',
        '/schedule ',
        'https://example.com/schedule',
        '//example.com/schedule',
        String.raw`\\example.com\schedule`,
        '/schedule\\details',
        '/schedule/%5c/example.com',
        '/schedule/%2f/example.com',
        '/schedule/%',
        '/schedule/../notifications',
        '/schedule/%2e%2e/notifications',
        '/api/users/current',
        '/prijava/google-prijava/povratak',
        '/debug',
        '/debug/labels',
        '/unknown',
        '/operations/0',
        '/operations/-1',
        '/operations/not-a-number',
        `/schedule?value=${'x'.repeat(2048)}`,
    ]) {
        expect(getSafeFarmReturnPath(returnTo)).toBe('/');
    }
});

test('builds a provider URL with only a validated internal callback target', () => {
    const authUrl = new URL(
        getFarmOAuthStartUrl({
            apiOrigin: 'https://api.gredice.com',
            farmOrigin: 'https://farma.gredice.com',
            provider: 'google',
            returnTo: '/notifications?filter=unread#notification-7',
        }),
    );
    const callbackUrl = new URL(authUrl.searchParams.get('redirect') ?? '');

    expect(authUrl.origin).toBe('https://api.gredice.com');
    expect(authUrl.pathname).toBe('/api/auth/google');
    expect(callbackUrl.origin).toBe('https://farma.gredice.com');
    expect(callbackUrl.pathname).toBe('/prijava/google-prijava/povratak');
    expect(callbackUrl.searchParams.get('returnTo')).toBe(
        '/notifications?filter=unread#notification-7',
    );

    const unsafeCallbackUrl = new URL(
        new URL(
            getFarmOAuthStartUrl({
                apiOrigin: 'https://api.gredice.com',
                farmOrigin: 'https://farma.gredice.com',
                provider: 'facebook',
                returnTo: 'https://example.com/steal',
            }),
        ).searchParams.get('redirect') ?? '',
    );
    expect(unsafeCallbackUrl.pathname).toBe(
        '/prijava/facebook-prijava/povratak',
    );
    expect(unsafeCallbackUrl.searchParams.get('returnTo')).toBe('/');
});
