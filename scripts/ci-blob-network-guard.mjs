import dns from 'node:dns';
import { syncBuiltinESMExports } from 'node:module';
import net from 'node:net';
import {
    createBlobFixtureFetch,
    isBlobHostname,
    isCiEmojiUrl,
} from './blob-test-fixtures.mjs';

// Only the GitHub Actions build/test step enables this preload. Production
// builds and ordinary local servers retain their real asset behavior.
const isolated = process.env.GREDICE_CI_NETWORK_ISOLATION === '1';
function isLoopback(hostname) {
    return (
        hostname === 'localhost' ||
        hostname?.endsWith('.localhost') ||
        hostname === '::1' ||
        hostname === '[::1]' ||
        (net.isIP(hostname) === 4 && hostname.startsWith('127.'))
    );
}
function blocked(hostname) {
    return isBlobHostname(hostname) || (isolated && !isLoopback(hostname));
}
function blockedError(hostname) {
    return Object.assign(
        new Error(
            `CI blocked a live infrastructure connection (${hostname}). Add a local test fixture.`,
        ),
        { code: 'ENOTFOUND' },
    );
}
if (process.env.GREDICE_CI_BLOB_FIXTURES === '1' || isolated) {
    globalThis.fetch = createBlobFixtureFetch(globalThis.fetch);
    if (isolated) {
        const fetchFixture = globalThis.fetch;
        globalThis.fetch = async (input, init) => {
            const url = new URL(
                typeof input === 'object' && input !== null && 'url' in input
                    ? input.url
                    : String(input),
            );
            const localAsset =
                ['www.gredice.com', 'vrt.gredice.com'].includes(url.hostname) &&
                url.pathname.startsWith('/assets/');
            if (
                !isBlobHostname(url.hostname) &&
                url.hostname !== 'cdn.gredice.com' &&
                !isLoopback(url.hostname) &&
                !isCiEmojiUrl(url.href) &&
                !localAsset
            ) {
                return Promise.reject(blockedError(url.hostname));
            }
            return fetchFixture(input, init);
        };
        // DNS guards alone cannot stop literal IP connections. The Linux
        // namespace is the final backstop for native libraries and browsers.
        const connect = net.Socket.prototype.connect;
        net.Socket.prototype.connect = function (...args) {
            const normalized = Array.isArray(args[0]) ? args[0] : args;
            const options = normalized[0];
            const host =
                typeof options === 'object'
                    ? options.host
                    : typeof normalized[1] === 'string'
                      ? normalized[1]
                      : undefined;
            if (host && !isLoopback(host)) {
                queueMicrotask(() => this.destroy(blockedError(host)));
                return this;
            }
            return connect.apply(this, args);
        };
    }

    // Also stop redirects and HTTP clients that do not use global fetch.
    const lookup = dns.lookup;
    dns.lookup = (hostname, options, callback) => {
        if (!blocked(hostname)) {
            return lookup.call(dns, hostname, options, callback);
        }
        const complete = typeof options === 'function' ? options : callback;
        const error = blockedError(hostname);
        queueMicrotask(() => complete(error));
    };
    const promiseLookup = dns.promises.lookup;
    dns.promises.lookup = async (hostname, options) => {
        if (blocked(hostname)) {
            throw blockedError(hostname);
        }
        return promiseLookup.call(dns.promises, hostname, options);
    };
    syncBuiltinESMExports();
}
