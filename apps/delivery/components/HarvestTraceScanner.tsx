'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Input } from '@gredice/ui/Input';
import {
    Camera,
    Check,
    Info,
    LoaderSpinner,
    Tally3,
    Warning,
} from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Typography } from '@gredice/ui/Typography';
import type { BrowserQRCodeReader } from '@zxing/library';
import {
    type FormEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import type {
    HarvestTraceSelectionResult,
    HarvestTraceVerificationResult,
} from '../lib/harvestTraceScan';

type CameraState =
    | 'requesting-permission'
    | 'scanning'
    | 'unsupported'
    | 'error';

type ScanHistoryItem = {
    id: number;
    color: 'success' | 'info' | 'warning' | 'danger';
    message: string;
};

type PickupRouteConflict = Extract<
    HarvestTraceSelectionResult,
    { status: 'route-conflict' }
>;

export type PickupManifestScanResult =
    | { status: 'pickup-invalid' }
    | { status: 'pickup-not-at-location'; tracePath: string }
    | { status: 'pickup-ambiguous'; tracePath: string }
    | {
          status: 'pickup-already-collected';
          tracePath: string;
          plantName: string;
      }
    | {
          status: 'pickup-not-ready';
          tracePath: string;
          plantName: string;
      }
    | {
          status: 'pickup-queued';
          tracePath: string;
          plantName: string;
          matchedCount: number;
      };

function scanHistoryItem(
    id: number,
    result:
        | HarvestTraceSelectionResult
        | HarvestTraceVerificationResult
        | PickupManifestScanResult,
): ScanHistoryItem {
    switch (result.status) {
        case 'selected':
            return {
                id,
                color: 'success',
                message: `${result.plantName} · ${result.contactName}. Odabrano ${result.deliveryCount} ${result.deliveryCount === 1 ? 'urod' : 'uroda'} na ovoj skupnoj stanici.`,
            };
        case 'already-selected':
            return {
                id,
                color: 'info',
                message: `${result.plantName} · ${result.contactName} već je u odabranoj skupnoj stanici.`,
            };
        case 'limit-reached':
            return {
                id,
                color: 'warning',
                message:
                    'Dosegnut je najveći broj fizičkih stanica za jednu rutu.',
            };
        case 'route-conflict':
            return {
                id,
                color: 'warning',
                message: result.message,
            };
        case 'ambiguous':
            return {
                id,
                color: 'warning',
                message:
                    'QR kod je povezan s više dostupnih termina. Odaberi dostavu ručno.',
            };
        case 'not-found':
            return {
                id,
                color: 'warning',
                message:
                    'Ovaj QR kod nije povezan ni s jednom trenutačno dostupnom dostavom.',
            };
        case 'not-ready':
            return {
                id,
                color: 'warning',
                message: `Dostava za ${result.plantName} · ${result.contactName} još nije spremna za preuzimanje na lokaciji.`,
            };
        case 'invalid':
            return {
                id,
                color: 'danger',
                message: 'Kod nije valjana Gredice poveznica traga uroda.',
            };
        case 'verified':
            return {
                id,
                color: 'success',
                message: `${result.plantName} · ${result.contactName} potvrđen je za ovu dostavu.`,
            };
        case 'already-verified':
            return {
                id,
                color: 'info',
                message: `${result.plantName} · ${result.contactName} već je provjeren na ovoj stanici.`,
            };
        case 'not-at-stop':
            return {
                id,
                color: 'warning',
                message:
                    'Ovaj QR kod nije na popisu uroda za trenutačnu stanicu.',
            };
        case 'verification-invalid':
            return {
                id,
                color: 'danger',
                message: 'Kod nije valjana Gredice poveznica traga uroda.',
            };
        case 'pickup-queued':
            return {
                id,
                color: 'success',
                message: `${result.plantName} · očitano ${result.matchedCount === 1 ? 'za manifest' : `za ${result.matchedCount} povezana uroda`}.`,
            };
        case 'pickup-already-collected':
            return {
                id,
                color: 'info',
                message: `${result.plantName} već je potvrđen na ovoj lokaciji preuzimanja.`,
            };
        case 'pickup-not-ready':
            return {
                id,
                color: 'warning',
                message: `${result.plantName} je označen kao nespreman i ostaje u manifestu.`,
            };
        case 'pickup-not-at-location':
            return {
                id,
                color: 'warning',
                message:
                    'Ovaj QR kod nije na manifestu trenutačne lokacije preuzimanja.',
            };
        case 'pickup-ambiguous':
            return {
                id,
                color: 'warning',
                message:
                    'Ovaj QR kod pripada različitim skupnim stanicama. Provjeri urode ručno.',
            };
        case 'pickup-invalid':
            return {
                id,
                color: 'danger',
                message: 'Kod nije valjana Gredice poveznica traga uroda.',
            };
    }
}

function cameraAccessError(error: unknown) {
    if (error instanceof DOMException) {
        switch (error.name) {
            case 'NotAllowedError':
            case 'SecurityError':
                return 'Dopusti pristup kameri u pregledniku. Kamera radi samo na sigurnoj HTTPS vezi.';
            case 'NotFoundError':
            case 'OverconstrainedError':
                return 'Na ovom uređaju nije pronađena dostupna kamera.';
            case 'NotReadableError':
                return 'Kameru trenutačno koristi druga aplikacija. Zatvori je i pokušaj ponovno.';
        }
    }

    return 'Kameru trenutačno nije moguće pokrenuti. Kod možeš unijeti ručno.';
}

export function HarvestTraceScanner({
    variant,
    availableTraceCount,
    disabled,
    completedTraceCount,
    onScan,
    onReplacePickupSelection,
}: {
    variant: 'pickup' | 'manifest' | 'verification';
    availableTraceCount: number;
    disabled: boolean;
    completedTraceCount: number;
    onScan: (
        value: string,
    ) =>
        | HarvestTraceSelectionResult
        | HarvestTraceVerificationResult
        | PickupManifestScanResult;
    onReplacePickupSelection?: (requestIds: string[]) => boolean;
}) {
    const [open, setOpen] = useState(false);
    const [cameraState, setCameraState] = useState<CameraState>(
        'requesting-permission',
    );
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [manualValue, setManualValue] = useState('');
    const [history, setHistory] = useState<ScanHistoryItem[]>([]);
    const [pickupRouteConflict, setPickupRouteConflict] =
        useState<PickupRouteConflict | null>(null);
    const [uniqueScanCount, setUniqueScanCount] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const readerRef = useRef<BrowserQRCodeReader | null>(null);
    const seenValuesRef = useRef(new Set<string>());
    const pickupRouteConflictScanValueRef = useRef<string | null>(null);
    const historyIdRef = useRef(0);
    const onScanRef = useRef(onScan);

    useEffect(() => {
        onScanRef.current = onScan;
    }, [onScan]);

    useEffect(() => {
        if (disabled) setOpen(false);
    }, [disabled]);

    const pushHistory = useCallback((item: Omit<ScanHistoryItem, 'id'>) => {
        historyIdRef.current += 1;
        setHistory((current) => [
            { id: historyIdRef.current, ...item },
            ...current.slice(0, 3),
        ]);
    }, []);

    const processScan = useCallback(
        (value: string, source: 'camera' | 'manual') => {
            if (disabled) return;
            const normalizedValue = value.trim();
            if (!normalizedValue) return;

            if (seenValuesRef.current.has(normalizedValue)) {
                if (source === 'manual') {
                    pushHistory({
                        color: 'info',
                        message: 'Ovaj je kod već očitan u trenutnoj sesiji.',
                    });
                }
                return;
            }

            seenValuesRef.current.add(normalizedValue);
            setUniqueScanCount(seenValuesRef.current.size);
            historyIdRef.current += 1;
            const result = onScanRef.current(normalizedValue);
            if (result.status === 'route-conflict') {
                const displacedConflictScanValue =
                    pickupRouteConflictScanValueRef.current;
                if (
                    displacedConflictScanValue &&
                    displacedConflictScanValue !== normalizedValue
                ) {
                    seenValuesRef.current.delete(displacedConflictScanValue);
                    setUniqueScanCount(seenValuesRef.current.size);
                }
                pickupRouteConflictScanValueRef.current = normalizedValue;
                setPickupRouteConflict(result);
            } else if (result.status === 'selected') {
                const resolvedConflictScanValue =
                    pickupRouteConflictScanValueRef.current;
                if (resolvedConflictScanValue) {
                    seenValuesRef.current.delete(resolvedConflictScanValue);
                    setUniqueScanCount(seenValuesRef.current.size);
                }
                pickupRouteConflictScanValueRef.current = null;
                setPickupRouteConflict(null);
            }
            setHistory((current) => [
                scanHistoryItem(historyIdRef.current, result),
                ...current.slice(0, 3),
            ]);

            if (
                result.status === 'selected' ||
                result.status === 'verified' ||
                result.status === 'pickup-queued'
            ) {
                navigator.vibrate?.(80);
            }
        },
        [disabled, pushHistory],
    );

    useEffect(() => {
        if (!open || disabled) return;

        if (!navigator.mediaDevices?.getUserMedia) {
            setCameraState('unsupported');
            setCameraError(
                'Ovaj preglednik ne podržava kameru. Kod možeš unijeti ručno.',
            );
            return;
        }

        let active = true;

        async function startScanner() {
            setCameraState('requesting-permission');
            setCameraError(null);

            try {
                const {
                    BrowserQRCodeReader,
                    ChecksumException,
                    FormatException,
                    NotFoundException,
                } = await import('@zxing/library');
                if (!active) return;

                const video = videoRef.current;
                if (!video) {
                    throw new Error('Camera preview is not available.');
                }

                const reader = new BrowserQRCodeReader(250);
                let decodingFailed = false;
                readerRef.current = reader;
                await reader.decodeFromConstraints(
                    {
                        audio: false,
                        video: {
                            facingMode: { ideal: 'environment' },
                            width: { ideal: 1280 },
                            height: { ideal: 720 },
                        },
                    },
                    video,
                    (result, error) => {
                        if (!active) return;
                        if (result) {
                            processScan(result.getText(), 'camera');
                            return;
                        }
                        if (
                            error &&
                            !(error instanceof NotFoundException) &&
                            !(error instanceof ChecksumException) &&
                            !(error instanceof FormatException)
                        ) {
                            decodingFailed = true;
                            reader.reset();
                            readerRef.current = null;
                            setCameraState('error');
                            setCameraError(
                                'QR kod nije moguće očitati. Pokušaj ponovno ili ga unesi ručno.',
                            );
                        }
                    },
                );

                if (active && !decodingFailed) {
                    setCameraState('scanning');
                } else if (!active) {
                    reader.reset();
                }
            } catch (error) {
                if (!active) return;
                readerRef.current?.reset();
                readerRef.current = null;
                setCameraState('error');
                setCameraError(cameraAccessError(error));
            }
        }

        void startScanner();

        return () => {
            active = false;
            readerRef.current?.reset();
            readerRef.current = null;

            const video = videoRef.current;
            if (video?.srcObject instanceof MediaStream) {
                for (const track of video.srcObject.getTracks()) {
                    track.stop();
                }
                video.srcObject = null;
            }
        };
    }, [disabled, open, processScan]);

    function openScanner() {
        seenValuesRef.current.clear();
        pickupRouteConflictScanValueRef.current = null;
        historyIdRef.current = 0;
        setHistory([]);
        setPickupRouteConflict(null);
        setUniqueScanCount(0);
        setManualValue('');
        setCameraError(null);
        setCameraState('requesting-permission');
        setOpen(true);
    }

    function submitManualValue(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        processScan(manualValue, 'manual');
        setManualValue('');
    }

    function replacePickupSelection(requestIds: string[]) {
        if (onReplacePickupSelection?.(requestIds)) {
            pickupRouteConflictScanValueRef.current = null;
            setPickupRouteConflict(null);
            return;
        }
        const failedScanValue = pickupRouteConflictScanValueRef.current;
        if (failedScanValue) {
            seenValuesRef.current.delete(failedScanValue);
            setUniqueScanCount(seenValuesRef.current.size);
        }
        pickupRouteConflictScanValueRef.current = null;
        setPickupRouteConflict(null);
        pushHistory({
            color: 'warning',
            message:
                'Dostave su se u međuvremenu promijenile. Osvježi odabir i skeniraj dostupni QR ponovno.',
        });
    }

    const verificationMode = variant === 'verification';
    const manifestMode = variant === 'manifest';

    return (
        <>
            <Button
                variant="outlined"
                disabled={disabled || availableTraceCount === 0}
                onClick={openScanner}
                startDecorator={<Camera className="size-4" />}
            >
                {verificationMode
                    ? 'Provjeri QR kodove'
                    : manifestMode
                      ? 'Skeniraj urode'
                      : 'Skeniraj QR kodove'}
            </Button>
            <Modal
                open={open}
                onOpenChange={setOpen}
                title={
                    verificationMode
                        ? 'Provjera uroda za dostavu'
                        : manifestMode
                          ? 'Preuzimanje uroda'
                          : 'Skeniranje tragova uroda'
                }
                description={
                    verificationMode
                        ? 'Skeniranje je pomoćna provjera i nikada ne blokira potvrdu dostave.'
                        : manifestMode
                          ? 'Kamera ostaje aktivna za brzo skeniranje svih uroda na trenutačnoj lokaciji.'
                          : 'Kamera ostaje aktivna kako bi se više QR kodova moglo očitati bez zatvaranja skenera.'
                }
                className="md:max-w-xl"
            >
                <div className="space-y-4">
                    <div className="pr-8">
                        <Typography level="h3" semiBold>
                            {verificationMode
                                ? 'Provjeri urode na stanici'
                                : manifestMode
                                  ? 'Skeniraj manifest preuzimanja'
                                  : 'Skeniraj tragove uroda'}
                        </Typography>
                        <Typography
                            level="body3"
                            className="mt-1 text-muted-foreground"
                        >
                            {verificationMode
                                ? 'Kamera ostaje uključena. Skeniraj etikete uroda koje predaješ korisniku.'
                                : manifestMode
                                  ? 'Kamera ostaje uključena. Svaki očitani QR potvrđuje odgovarajući urod na ovoj lokaciji.'
                                  : 'Kamera ostaje uključena. Svaki novi QR automatski odabire cijelu skupnu stanicu dostave.'}
                        </Typography>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Chip color="info" size="sm">
                            <Tally3 className="mr-1 size-4" />
                            {uniqueScanCount} očitano
                        </Chip>
                        <Chip color="success" size="sm">
                            <Check className="mr-1 size-4" />
                            {completedTraceCount}{' '}
                            {verificationMode
                                ? 'provjereno'
                                : manifestMode
                                  ? 'preuzeto'
                                  : 'odabrano'}
                        </Chip>
                        <Chip color="neutral" size="sm">
                            {availableTraceCount}{' '}
                            {verificationMode
                                ? 'očekivanih QR kodova'
                                : manifestMode
                                  ? 'uroda u manifestu'
                                  : 'dostupnih QR kodova'}
                        </Chip>
                    </div>

                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
                        <video
                            ref={videoRef}
                            className="h-full w-full object-cover"
                            playsInline
                            muted
                            aria-label="Prikaz kamere za skeniranje QR kodova"
                        />
                        {cameraState === 'scanning' ? (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                                <div className="size-52 rounded-2xl border-2 border-dashed border-white shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 px-6 text-center text-white">
                                {cameraState === 'requesting-permission' ? (
                                    <LoaderSpinner className="size-7 animate-spin" />
                                ) : (
                                    <Camera className="size-8" />
                                )}
                                <Typography component="span" level="body2">
                                    {cameraState === 'requesting-permission'
                                        ? 'Pokretanje kamere…'
                                        : 'Kamera nije dostupna'}
                                </Typography>
                            </div>
                        )}
                        {cameraState === 'scanning' ? (
                            <div className="absolute inset-x-3 bottom-3 flex justify-center">
                                <Chip color="neutral" size="sm">
                                    Kamera je aktivna · usmjeri sljedeći QR
                                </Chip>
                            </div>
                        ) : null}
                    </div>

                    {cameraError ? (
                        <Alert
                            color="warning"
                            startDecorator={<Warning className="size-5" />}
                        >
                            {cameraError}
                        </Alert>
                    ) : null}

                    {pickupRouteConflict && onReplacePickupSelection ? (
                        <Alert
                            color="warning"
                            startDecorator={<Warning className="size-5" />}
                        >
                            <div className="space-y-3">
                                <span className="block">
                                    {pickupRouteConflict.message}
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {pickupRouteConflict.conflictingRequestIds
                                        .length > 0 ? (
                                        <Button
                                            size="sm"
                                            variant="outlined"
                                            onClick={() =>
                                                replacePickupSelection(
                                                    pickupRouteConflict.conflictingRequestIds,
                                                )
                                            }
                                        >
                                            Odaberi izdvojenu skupinu
                                        </Button>
                                    ) : null}
                                    {pickupRouteConflict.separateRouteRequestIds
                                        .length > 0 ? (
                                        <Button
                                            size="sm"
                                            variant="plain"
                                            onClick={() =>
                                                replacePickupSelection(
                                                    pickupRouteConflict.separateRouteRequestIds,
                                                )
                                            }
                                        >
                                            Zadrži trenutačni odabir
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        </Alert>
                    ) : null}

                    <div
                        className="space-y-2"
                        role="log"
                        aria-label="Posljednja očitanja"
                        aria-live="polite"
                        aria-relevant="additions"
                    >
                        {history.map((item) => (
                            <Alert
                                key={item.id}
                                color={item.color}
                                startDecorator={
                                    item.color === 'success' ? (
                                        <Check className="size-5" />
                                    ) : item.color === 'info' ? (
                                        <Info className="size-5" />
                                    ) : (
                                        <Warning className="size-5" />
                                    )
                                }
                            >
                                {item.message}
                            </Alert>
                        ))}
                    </div>

                    <form
                        className="flex flex-col gap-2 sm:flex-row sm:items-end"
                        onSubmit={submitManualValue}
                    >
                        <Input
                            label="Ručni unos"
                            helperText="Zalijepi cijelu poveznicu ili token s etikete."
                            placeholder="https://www.gredice.com/trag/…"
                            value={manualValue}
                            onChange={(event) =>
                                setManualValue(event.target.value)
                            }
                            autoCapitalize="none"
                            autoComplete="off"
                            spellCheck={false}
                            fullWidth
                        />
                        <Button
                            type="submit"
                            variant="outlined"
                            disabled={!manualValue.trim()}
                            className="sm:mb-5"
                        >
                            Dodaj kod
                        </Button>
                    </form>

                    <Button className="w-full" onClick={() => setOpen(false)}>
                        {verificationMode
                            ? 'Završi provjeru'
                            : 'Završi skeniranje'}
                    </Button>
                </div>
            </Modal>
        </>
    );
}
