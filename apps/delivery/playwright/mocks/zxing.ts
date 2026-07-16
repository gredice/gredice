type DecodeResult = {
    getText: () => string;
};

type DecodeCallback = (
    result: DecodeResult | undefined,
    error: Error | undefined,
) => void;

type ScanEvent = CustomEvent<{ value: string }>;
type ErrorEvent = CustomEvent<{ name: string }>;

export class NotFoundException extends Error {}
export class ChecksumException extends Error {}
export class FormatException extends Error {}

export class BrowserQRCodeReader {
    private callback: DecodeCallback | null = null;
    private stream: MediaStream | null = null;

    private readonly handleScan = (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const scanEvent: ScanEvent = event;
        if (typeof scanEvent.detail?.value !== 'string') return;
        this.callback?.({ getText: () => scanEvent.detail.value }, undefined);
    };

    private readonly handleError = (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const errorEvent: ErrorEvent = event;
        const error = new Error('Synthetic QR decode failure.');
        error.name = errorEvent.detail?.name ?? 'DecodeError';
        this.callback?.(undefined, error);
    };

    async decodeFromConstraints(
        constraints: MediaStreamConstraints,
        _video: HTMLVideoElement,
        callback: DecodeCallback,
    ) {
        this.callback = callback;
        if (document.documentElement.dataset.cameraRequestCount !== undefined) {
            this.stream =
                await navigator.mediaDevices.getUserMedia(constraints);
        }
        window.addEventListener('delivery-test-qr-scan', this.handleScan);
        window.addEventListener('delivery-test-qr-error', this.handleError);
    }

    reset() {
        window.removeEventListener('delivery-test-qr-scan', this.handleScan);
        window.removeEventListener('delivery-test-qr-error', this.handleError);
        for (const track of this.stream?.getTracks() ?? []) track.stop();
        this.stream = null;
        this.callback = null;
    }
}
