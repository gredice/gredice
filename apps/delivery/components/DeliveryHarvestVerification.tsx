'use client';

import { Alert } from '@gredice/ui/Alert';
import { Chip } from '@gredice/ui/Chip';
import { Check, Info } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { useId, useRef, useState } from 'react';
import type { DeliveryStopDeliverySummary } from '../lib/deliveryDashboardTypes';
import { isDriverCommandResult } from '../lib/driverCommandResult';
import {
    normalizeHarvestTraceScanValue,
    verifyDeliveryStopHarvestTrace,
} from '../lib/harvestTraceScan';
import {
    type HarvestTraceScanFailureResult,
    HarvestTraceScanner,
} from './HarvestTraceScanner';

export function DeliveryHarvestVerification({
    deliveries,
    disabled,
    compact = false,
    verifiedTracePaths: persistedVerifiedTracePaths = [],
    onVerifiedTrace,
}: {
    deliveries: DeliveryStopDeliverySummary[];
    disabled: boolean;
    compact?: boolean;
    verifiedTracePaths?: string[];
    onVerifiedTrace?: (tracePath: string) => unknown | Promise<unknown>;
}) {
    const headingId = useId();
    const [localVerifiedTracePaths, setLocalVerifiedTracePaths] = useState<
        string[]
    >([]);
    const verifiedTracePathsRef = useRef<string[]>([]);
    const verifiedTracePaths = Array.from(
        new Set([...persistedVerifiedTracePaths, ...localVerifiedTracePaths]),
    );
    verifiedTracePathsRef.current = verifiedTracePaths;
    const tracePathByRequestId = new Map(
        deliveries.flatMap((delivery) => {
            const tracePath = delivery.harvest.tracePath
                ? normalizeHarvestTraceScanValue(delivery.harvest.tracePath)
                : null;
            return tracePath ? [[delivery.requestId, tracePath]] : [];
        }),
    );
    const expectedTracePaths = new Set(tracePathByRequestId.values());
    const verifiedTracePathSet = new Set(
        verifiedTracePaths.filter((tracePath) =>
            expectedTracePaths.has(tracePath),
        ),
    );
    const expectedTraceCount = expectedTracePaths.size;
    const verifiedTraceCount = verifiedTracePathSet.size;
    const allExpectedTracesVerified =
        expectedTraceCount > 0 && verifiedTraceCount === expectedTraceCount;

    const verifyTrace = async (
        value: string,
    ): Promise<
        | ReturnType<typeof verifyDeliveryStopHarvestTrace>
        | HarvestTraceScanFailureResult
    > => {
        const result = verifyDeliveryStopHarvestTrace({
            deliveries,
            verifiedTracePaths: verifiedTracePathsRef.current,
            scanValue: value,
        });

        if (result.status === 'verified') {
            const persistenceResult = await onVerifiedTrace?.(result.tracePath);
            if (
                isDriverCommandResult(persistenceResult) &&
                persistenceResult.status === 'failed'
            ) {
                return {
                    status: 'scan-failed',
                    message: persistenceResult.message,
                };
            }
            verifiedTracePathsRef.current = result.nextVerifiedTracePaths;
            setLocalVerifiedTracePaths(result.nextVerifiedTracePaths);
        }

        return result;
    };

    return (
        <section
            className={compact ? 'space-y-2' : 'space-y-3'}
            aria-labelledby={headingId}
        >
            <div>
                <Typography id={headingId} level="body2" semiBold>
                    QR provjera predaje
                </Typography>
                <Typography
                    level="body3"
                    className={
                        compact ? 'sr-only' : 'mt-0.5 text-muted-foreground'
                    }
                >
                    Provjeri urode dok ih predaješ korisniku kako ništa ne bi
                    ostalo u vozilu.
                </Typography>
            </div>

            <Alert
                color={allExpectedTracesVerified ? 'success' : 'info'}
                startDecorator={
                    allExpectedTracesVerified ? (
                        <Check className="size-5" />
                    ) : (
                        <Info className="size-5" />
                    )
                }
            >
                {expectedTraceCount === 0
                    ? 'Za ovu stanicu nema dostupnih QR kodova. Nastavi ručnom provjerom.'
                    : allExpectedTracesVerified
                      ? 'Svi urodi s dostupnim QR kodom provjereni su za ovu stanicu.'
                      : `Provjereno ${verifiedTraceCount} od ${expectedTraceCount}. Skeniraj preostale etikete ako su dostupne.`}
            </Alert>

            {expectedTraceCount > 0 ? (
                <HarvestTraceScanner
                    variant="verification"
                    availableTraceCount={expectedTraceCount}
                    completedTraceCount={verifiedTraceCount}
                    disabled={disabled}
                    onScan={verifyTrace}
                />
            ) : null}

            <ul
                className={compact ? 'sr-only' : 'space-y-2'}
                aria-label="Urodi na ovoj stanici"
            >
                {deliveries.map((delivery) => {
                    const tracePath = tracePathByRequestId.get(
                        delivery.requestId,
                    );
                    const verified = Boolean(
                        tracePath && verifiedTracePathSet.has(tracePath),
                    );

                    return (
                        <li
                            key={delivery.requestId}
                            className="flex items-center justify-between gap-3 rounded-md bg-muted/70 px-3 py-2"
                        >
                            <div className="min-w-0">
                                <Typography
                                    level="body3"
                                    semiBold
                                    className="truncate"
                                >
                                    {delivery.harvest.plantName}
                                </Typography>
                                <Typography
                                    level="body3"
                                    className="truncate text-muted-foreground"
                                >
                                    {delivery.contactName}
                                </Typography>
                            </div>
                            <Chip
                                color={verified ? 'success' : 'neutral'}
                                size="sm"
                            >
                                {verified
                                    ? 'Provjereno'
                                    : tracePath
                                      ? 'Nije skenirano'
                                      : 'Bez QR koda'}
                            </Chip>
                        </li>
                    );
                })}
            </ul>

            <Typography level="body3" className="text-muted-foreground">
                {compact
                    ? 'Provjera nije obavezna i ne blokira potvrdu dostave.'
                    : 'Ova provjera nije obavezna. Dostavu možeš potvrditi i ako etiketa nedostaje ili skeniranje nije moguće.'}
            </Typography>
        </section>
    );
}
