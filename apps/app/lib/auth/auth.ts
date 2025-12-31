import 'server-only';
import {
    baseAuth,
    baseWithAuth,
    clearCookie,
    createJwt,
    setCookie,
    verifyJwt,
} from './baseAuth';
import { refreshSessionIfNeeded } from './sessionRefresh';

export { clearCookie, createJwt, setCookie, verifyJwt };

export function auth(...args: Parameters<typeof baseAuth>) {
    return refreshSessionIfNeeded().then(() => baseAuth(...args));
}

export function withAuth(...args: Parameters<typeof baseWithAuth>) {
    return refreshSessionIfNeeded().then(() => baseWithAuth(...args));
}
