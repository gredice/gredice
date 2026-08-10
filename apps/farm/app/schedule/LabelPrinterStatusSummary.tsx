import type { LabelPrinterSnapshot } from '@gredice/label-printer';
import {
    BatteryFull,
    BatteryLow,
    BatteryMedium,
    Link,
    LinkOff,
    Lock,
    Printer,
    Warning,
} from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { SegmentedCircularProgress } from '@gredice/ui/SegmentedCircularProgress';

function getStatusPillClassName(tone: 'neutral' | 'success' | 'warning') {
    switch (tone) {
        case 'success':
            return 'inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700';
        case 'warning':
            return 'inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700';
        default:
            return 'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-1 text-xs font-medium text-foreground';
    }
}

function getConsumableUsagePercentage(snapshot: LabelPrinterSnapshot) {
    if (!snapshot.consumableUsage) {
        return null;
    }

    const { remaining, total } = snapshot.consumableUsage;
    if (total <= 0) {
        return 0;
    }

    return Math.round((Math.max(0, Math.min(remaining, total)) / total) * 100);
}

interface LabelPrinterStatusSummaryProps {
    snapshot: LabelPrinterSnapshot;
}

export function LabelPrinterStatusSummary({
    snapshot,
}: LabelPrinterStatusSummaryProps) {
    const consumableUsagePercentage = getConsumableUsagePercentage(snapshot);

    return (
        <Row spacing={2} className="flex-wrap items-center gap-y-2">
            <span
                className={getStatusPillClassName(
                    snapshot.isConnected ? 'success' : 'neutral',
                )}
            >
                {snapshot.isConnected ? (
                    <Link aria-hidden className="size-3.5" />
                ) : (
                    <LinkOff aria-hidden className="size-3.5" />
                )}
                {snapshot.isConnected ? 'Povezan' : 'Nije povezan'}
            </span>
            {snapshot.batteryPercent !== undefined && (
                <span
                    className={getStatusPillClassName(
                        snapshot.batteryPercent > 25 ? 'success' : 'warning',
                    )}
                >
                    {snapshot.batteryPercent > 75 ? (
                        <BatteryFull aria-hidden className="size-3.5" />
                    ) : snapshot.batteryPercent > 25 ? (
                        <BatteryMedium aria-hidden className="size-3.5" />
                    ) : (
                        <BatteryLow aria-hidden className="size-3.5" />
                    )}
                    Baterija {snapshot.batteryPercent}%
                </span>
            )}
            {snapshot.paperInserted !== undefined && (
                <span
                    className={getStatusPillClassName(
                        snapshot.paperInserted ? 'success' : 'warning',
                    )}
                >
                    {snapshot.paperInserted ? (
                        <Printer aria-hidden className="size-3.5" />
                    ) : (
                        <Warning aria-hidden className="size-3.5" />
                    )}
                    {snapshot.paperInserted
                        ? 'Etikete su umetnute'
                        : 'Nema umetnutih etiketa'}
                </span>
            )}
            {snapshot.lidClosed !== undefined && (
                <span
                    className={getStatusPillClassName(
                        snapshot.lidClosed ? 'success' : 'warning',
                    )}
                >
                    {snapshot.lidClosed ? (
                        <Lock aria-hidden className="size-3.5" />
                    ) : (
                        <Warning aria-hidden className="size-3.5" />
                    )}
                    {snapshot.lidClosed
                        ? 'Poklopac zatvoren'
                        : 'Poklopac otvoren'}
                </span>
            )}
            {snapshot.consumableUsage && consumableUsagePercentage !== null && (
                <div
                    role="progressbar"
                    aria-label="Preostale etikete u pisaču"
                    aria-valuemin={0}
                    aria-valuemax={snapshot.consumableUsage.total}
                    aria-valuenow={snapshot.consumableUsage.remaining}
                >
                    <SegmentedCircularProgress
                        size={64}
                        strokeWidth={3}
                        segments={[
                            {
                                percentage: 100,
                                value: consumableUsagePercentage,
                                color:
                                    snapshot.consumableUsage.remaining > 0
                                        ? 'stroke-green-500'
                                        : 'stroke-amber-500',
                                trackColor: 'stroke-muted',
                            },
                        ]}
                    >
                        <span className="flex flex-col items-center text-center leading-none">
                            <span className="text-sm font-semibold text-foreground">
                                {snapshot.consumableUsage.remaining}
                            </span>
                            <span className="mt-0.5 text-[10px] text-muted-foreground">
                                / {snapshot.consumableUsage.total}
                            </span>
                        </span>
                    </SegmentedCircularProgress>
                </div>
            )}
        </Row>
    );
}
