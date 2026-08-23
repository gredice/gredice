import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import { DriverRouteContinuityStory } from './DriverRouteContinuityStory';
import '../app/globals.css';

async function installWakeLockBrowser(
    page: Page,
    options: {
        supported?: boolean;
        rejectFirstRequest?: boolean;
        deferFirstRequest?: boolean;
        deferRequestCount?: number;
    } = {},
) {
    await page.evaluate(
        ({
            supported,
            rejectFirstRequest,
            deferFirstRequest,
            deferRequestCount,
        }) => {
            let visibility: DocumentVisibilityState = 'visible';
            let requestCount = 0;
            let releaseCount = 0;
            let shouldReject = rejectFirstRequest;
            let deferredRequestsRemaining =
                deferRequestCount ?? (deferFirstRequest ? 1 : 0);
            const sentinels: Array<{
                released: boolean;
                release: () => Promise<void>;
            }> = [];
            const deferredResolvers: Array<() => void> = [];
            const root = document.documentElement;

            const syncMetrics = () => {
                root.dataset.wakeLockRequestCount = String(requestCount);
                root.dataset.wakeLockReleaseCount = String(releaseCount);
            };
            const createSentinel = () => {
                let released = false;
                const target = new EventTarget();
                const sentinel = {
                    get released() {
                        return released;
                    },
                    get type() {
                        return 'screen' as const;
                    },
                    onrelease: null,
                    addEventListener: target.addEventListener.bind(target),
                    removeEventListener:
                        target.removeEventListener.bind(target),
                    dispatchEvent: target.dispatchEvent.bind(target),
                    async release() {
                        if (released) return;
                        released = true;
                        releaseCount += 1;
                        syncMetrics();
                        target.dispatchEvent(new Event('release'));
                    },
                };
                sentinels.push(sentinel);
                return sentinel;
            };

            Object.defineProperty(document, 'visibilityState', {
                configurable: true,
                get: () => visibility,
            });
            if (supported) {
                Object.defineProperty(navigator, 'wakeLock', {
                    configurable: true,
                    value: {
                        async request() {
                            requestCount += 1;
                            syncMetrics();
                            if (shouldReject) {
                                shouldReject = false;
                                throw new DOMException(
                                    'Wake lock unavailable',
                                    'NotAllowedError',
                                );
                            }
                            if (deferredRequestsRemaining > 0) {
                                deferredRequestsRemaining -= 1;
                                return await new Promise((resolve) => {
                                    deferredResolvers.push(() =>
                                        resolve(createSentinel()),
                                    );
                                });
                            }
                            return createSentinel();
                        },
                    },
                });
            } else {
                Reflect.deleteProperty(navigator, 'wakeLock');
                const prototype: object | null =
                    Object.getPrototypeOf(navigator);
                if (prototype) Reflect.deleteProperty(prototype, 'wakeLock');
            }

            window.addEventListener('wake-lock-test-visibility', (event) => {
                if (!(event instanceof CustomEvent)) return;
                visibility = event.detail;
                document.dispatchEvent(new Event('visibilitychange'));
            });
            window.addEventListener('wake-lock-test-browser-release', () => {
                const sentinel = sentinels.at(-1);
                if (!sentinel || sentinel.released) return;
                void sentinel.release();
            });
            window.addEventListener('wake-lock-test-resolve', () => {
                deferredResolvers.shift()?.();
            });
            syncMetrics();
        },
        {
            supported: options.supported ?? true,
            rejectFirstRequest: options.rejectFirstRequest ?? false,
            deferFirstRequest: options.deferFirstRequest ?? false,
            deferRequestCount: options.deferRequestCount,
        },
    );
}

test('requests a wake lock only after explicit route consent and releases on opt-out', async ({
    mount,
    page,
}) => {
    await installWakeLockBrowser(page);
    const component = await mount(<DriverRouteContinuityStory />);
    const toggle = component.getByRole('switch', {
        name: 'Drži zaslon uključenim',
    });

    await expect(component).toContainText('GPS se može pauzirati');
    await expect(component.getByRole('status')).toBeEmpty();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('html')).toHaveAttribute(
        'data-wake-lock-request-count',
        '0',
    );

    await toggle.click();
    await expect(component).toHaveAttribute('data-wake-lock-status', 'active');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(component).toContainText(
        'Prelazak u drugu aplikaciju i dalje može pauzirati GPS',
    );
    await expect(component.getByRole('status')).toHaveText(
        'Zaslon ostaje uključen za ovu aktivnu rutu.',
    );
    await expect(page.locator('html')).toHaveAttribute(
        'data-wake-lock-request-count',
        '1',
    );

    await toggle.click();
    await expect(component).toHaveAttribute('data-wake-lock-status', 'off');
    await expect(page.locator('html')).toHaveAttribute(
        'data-wake-lock-release-count',
        '1',
    );
});

test('releases while hidden and reacquires only for the consented route', async ({
    mount,
    page,
}) => {
    await installWakeLockBrowser(page);
    const component = await mount(<DriverRouteContinuityStory />);
    await component
        .getByRole('switch', { name: 'Drži zaslon uključenim' })
        .click();
    await expect(component).toHaveAttribute('data-wake-lock-status', 'active');

    await page.evaluate(() => {
        window.dispatchEvent(
            new CustomEvent('wake-lock-test-visibility', {
                detail: 'hidden',
            }),
        );
    });
    await expect(page.locator('html')).toHaveAttribute(
        'data-wake-lock-release-count',
        '1',
    );

    await page.evaluate(() => {
        window.dispatchEvent(
            new CustomEvent('wake-lock-test-visibility', {
                detail: 'visible',
            }),
        );
    });
    await expect(component).toHaveAttribute('data-wake-lock-status', 'active');
    await expect(page.locator('html')).toHaveAttribute(
        'data-wake-lock-request-count',
        '2',
    );
    await page.evaluate(() => {
        window.dispatchEvent(
            new CustomEvent('wake-lock-test-visibility', {
                detail: 'visible',
            }),
        );
        window.dispatchEvent(new PageTransitionEvent('pageshow'));
    });
    await expect(page.locator('html')).toHaveAttribute(
        'data-wake-lock-request-count',
        '2',
    );

    await component.update(<DriverRouteContinuityStory runId="run-two" />);
    await expect(component).toHaveAttribute('data-wake-lock-status', 'off');
    await expect(
        component.getByRole('switch', { name: 'Drži zaslon uključenim' }),
    ).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('html')).toHaveAttribute(
        'data-wake-lock-release-count',
        '2',
    );
    await expect(page.locator('html')).toHaveAttribute(
        'data-wake-lock-request-count',
        '2',
    );
});

test('shows unsupported and browser-release recovery states truthfully', async ({
    mount,
    page,
}) => {
    await installWakeLockBrowser(page, { supported: false });
    const unsupported = await mount(<DriverRouteContinuityStory />);
    await expect(unsupported).toHaveAttribute(
        'data-wake-lock-status',
        'unsupported',
    );
    await expect(
        unsupported.getByRole('switch', {
            name: 'Drži zaslon uključenim',
        }),
    ).toBeDisabled();
    await unsupported.unmount();

    await installWakeLockBrowser(page);
    const released = await mount(<DriverRouteContinuityStory />);
    await released
        .getByRole('switch', { name: 'Drži zaslon uključenim' })
        .click();
    await page.evaluate(() => {
        window.dispatchEvent(new Event('wake-lock-test-browser-release'));
    });
    await expect(released).toHaveAttribute('data-wake-lock-status', 'error');
    await expect(
        released.getByRole('switch', {
            name: 'Drži zaslon uključenim',
        }),
    ).toHaveAttribute('aria-checked', 'false');
    await expect(released).toContainText('nije zadržao zaslon uključenim');
    await expect(
        released.getByRole('button', { name: 'Pokušaj ponovno' }),
    ).toBeVisible();
});

test('recovers from a rejected request without claiming GPS is active', async ({
    mount,
    page,
}) => {
    await installWakeLockBrowser(page, { rejectFirstRequest: true });
    const component = await mount(<DriverRouteContinuityStory />);
    await component
        .getByRole('switch', { name: 'Drži zaslon uključenim' })
        .click();
    await expect(component).toHaveAttribute('data-wake-lock-status', 'error');
    await expect(component).not.toContainText('GPS praćenje je aktivno');

    await component.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect(component).toHaveAttribute('data-wake-lock-status', 'active');
    await expect(page.locator('html')).toHaveAttribute(
        'data-wake-lock-request-count',
        '2',
    );
});

test('releases a late request after consent is withdrawn and cleans up on unmount', async ({
    mount,
    page,
}) => {
    await installWakeLockBrowser(page, { deferFirstRequest: true });
    const component = await mount(<DriverRouteContinuityStory />);
    const toggle = component.getByRole('switch', {
        name: 'Drži zaslon uključenim',
    });
    await toggle.click();
    await expect(component).toHaveAttribute(
        'data-wake-lock-status',
        'requesting',
    );
    await toggle.click();
    await page.evaluate(() => {
        window.dispatchEvent(new Event('wake-lock-test-resolve'));
    });
    await expect(page.locator('html')).toHaveAttribute(
        'data-wake-lock-release-count',
        '1',
    );
    await expect(component).toHaveAttribute('data-wake-lock-status', 'off');

    await toggle.click();
    await expect(component).toHaveAttribute('data-wake-lock-status', 'active');
    await component.unmount();
    await expect(page.locator('html')).toHaveAttribute(
        'data-wake-lock-release-count',
        '2',
    );
});

test('a stale hidden-page resolution cannot unlock a newer pending acquisition', async ({
    mount,
    page,
}) => {
    await installWakeLockBrowser(page, { deferRequestCount: 2 });
    const component = await mount(<DriverRouteContinuityStory />);
    await component
        .getByRole('switch', { name: 'Drži zaslon uključenim' })
        .click();
    await page.evaluate(() => {
        window.dispatchEvent(
            new CustomEvent('wake-lock-test-visibility', {
                detail: 'hidden',
            }),
        );
        window.dispatchEvent(
            new CustomEvent('wake-lock-test-visibility', {
                detail: 'visible',
            }),
        );
    });
    await expect(page.locator('html')).toHaveAttribute(
        'data-wake-lock-request-count',
        '2',
    );

    await page.evaluate(() => {
        window.dispatchEvent(new Event('wake-lock-test-resolve'));
    });
    await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pageshow'));
    });
    await expect(page.locator('html')).toHaveAttribute(
        'data-wake-lock-request-count',
        '2',
    );
    await expect(component).toHaveAttribute(
        'data-wake-lock-status',
        'requesting',
    );

    await page.evaluate(() => {
        window.dispatchEvent(new Event('wake-lock-test-resolve'));
    });
    await expect(component).toHaveAttribute('data-wake-lock-status', 'active');
});

test('cached offline route distinguishes screen continuity from inactive GPS tracking', async ({
    mount,
    page,
}) => {
    await installWakeLockBrowser(page);
    const component = await mount(
        <DriverRouteContinuityStory trackingAvailable={false} />,
    );
    await expect(component).toContainText(
        'GPS praćenje nije aktivno dok se ne učita stanje poslužitelja',
    );
    await expect(component).not.toContainText('GPS se može pauzirati');

    await component
        .getByRole('switch', { name: 'Drži zaslon uključenim' })
        .click();
    await expect(component).toHaveAttribute('data-wake-lock-status', 'active');
    await expect(component.getByRole('status')).toHaveText(
        'Zaslon ostaje uključen za izvanmrežnu rutu. GPS praćenje nije aktivno.',
    );
});
