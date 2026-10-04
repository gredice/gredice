import type { Page } from '@playwright/test';

export async function installCameraDouble(
    page: Page,
    options: { errorName?: string } = {},
) {
    await page.evaluate(({ errorName }) => {
        let requestCount = 0;
        let stopCount = 0;
        let vibrationCount = 0;
        const root = document.documentElement;
        const syncMetrics = () => {
            root.dataset.cameraRequestCount = String(requestCount);
            root.dataset.cameraTrackStopCount = String(stopCount);
            root.dataset.cameraVibrationCount = String(vibrationCount);
        };
        Object.defineProperty(navigator, 'vibrate', {
            configurable: true,
            value: () => {
                vibrationCount += 1;
                syncMetrics();
                return true;
            },
        });
        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: {
                getUserMedia: async () => {
                    requestCount += 1;
                    syncMetrics();
                    if (errorName) {
                        throw new DOMException(
                            'Synthetic camera access failure.',
                            errorName,
                        );
                    }
                    return {
                        getTracks: () => [
                            {
                                stop: () => {
                                    stopCount += 1;
                                    syncMetrics();
                                },
                            },
                        ],
                    };
                },
            },
        });
        syncMetrics();
    }, options);
}

export async function emitQrScan(page: Page, value: string) {
    await page.evaluate((scanValue) => {
        window.dispatchEvent(
            new CustomEvent('delivery-test-qr-scan', {
                detail: { value: scanValue },
            }),
        );
    }, value);
}

export async function emitQrDecodeError(page: Page, name = 'DecodeError') {
    await page.evaluate((errorName) => {
        window.dispatchEvent(
            new CustomEvent('delivery-test-qr-error', {
                detail: { name: errorName },
            }),
        );
    }, name);
}

export async function installGeolocationDouble(page: Page) {
    await page.addInitScript(() => {
        type Watcher = {
            success: PositionCallback;
            error: PositionErrorCallback | null;
        };
        const watchers = new Map<number, Watcher>();
        let nextWatchId = 1;
        const permissionStatus = {
            state: 'granted' as PermissionState,
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => true,
        };
        Object.defineProperty(navigator, 'permissions', {
            configurable: true,
            value: {
                query: async () => permissionStatus,
            },
        });
        Object.defineProperty(navigator, 'geolocation', {
            configurable: true,
            value: {
                watchPosition(
                    success: PositionCallback,
                    error: PositionErrorCallback | null,
                ) {
                    const watchId = nextWatchId;
                    nextWatchId += 1;
                    watchers.set(watchId, { success, error });
                    document.documentElement.dataset.geolocationWatchCount =
                        String(watchers.size);
                    return watchId;
                },
                clearWatch(watchId: number) {
                    watchers.delete(watchId);
                    document.documentElement.dataset.geolocationWatchCount =
                        String(watchers.size);
                },
                getCurrentPosition(success: PositionCallback) {
                    watchers.set(0, { success, error: null });
                },
            },
        });
        window.addEventListener('delivery-test-geolocation', (event) => {
            if (!(event instanceof CustomEvent)) return;
            const detail: unknown = event.detail;
            if (typeof detail !== 'object' || detail === null) return;
            const latitude = Reflect.get(detail, 'latitude');
            const longitude = Reflect.get(detail, 'longitude');
            const timestamp = Reflect.get(detail, 'timestamp');
            if (
                typeof latitude !== 'number' ||
                typeof longitude !== 'number' ||
                typeof timestamp !== 'number'
            ) {
                return;
            }
            const position = {
                coords: {
                    latitude,
                    longitude,
                    accuracy: 6,
                    altitude: null,
                    altitudeAccuracy: null,
                    heading: 90,
                    speed: 5,
                    toJSON: () => ({}),
                },
                timestamp,
                toJSON: () => ({}),
            };
            for (const watcher of watchers.values()) {
                watcher.success(position);
            }
            watchers.delete(0);
        });
    });
}

export async function emitGeolocation(
    page: Page,
    position: { latitude: number; longitude: number; timestamp: number },
) {
    await page.evaluate((detail) => {
        window.dispatchEvent(
            new CustomEvent('delivery-test-geolocation', { detail }),
        );
    }, position);
}
