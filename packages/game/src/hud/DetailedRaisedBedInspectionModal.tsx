'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card } from '@gredice/ui/Card';
import { Sprout } from '@gredice/ui/icons';
import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { useState } from 'react';
import type { DetailedRaisedBedInspectionReport } from '../hooks/useDetailedRaisedBedInspectionReports';
import { GameModal } from '../shared-ui/game-modal';

function RaisedBedReviewThumbnail({
    report,
}: {
    report: DetailedRaisedBedInspectionReport;
}) {
    const [imageFailed, setImageFailed] = useState(false);
    const showImage = Boolean(report.raisedBedImageUrl) && !imageFailed;

    return (
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted text-muted-foreground">
            {showImage ? (
                // biome-ignore lint/performance/noImgElement: Raised bed operation photos use runtime blob URLs.
                <img
                    alt={`Najnovija fotografija gredice ${report.raisedBedName}`}
                    className="size-full object-cover"
                    data-raised-bed-review-photo
                    loading="lazy"
                    onError={() => setImageFailed(true)}
                    src={report.raisedBedImageUrl ?? undefined}
                />
            ) : (
                <span data-raised-bed-review-fallback>
                    <RaisedBedIcon
                        className="size-7"
                        containerClassName="h-8 min-w-8"
                        physicalId={report.raisedBedPhysicalId}
                    />
                </span>
            )}
        </span>
    );
}

export function DetailedRaisedBedInspectionModal({
    dismissError,
    dismissPending,
    onClose,
    onRetryDismiss,
    open,
    reports,
}: {
    dismissError: Error | null;
    dismissPending: boolean;
    onClose: () => void;
    onRetryDismiss: () => void;
    open: boolean;
    reports: DetailedRaisedBedInspectionReport[];
}) {
    return (
        <GameModal
            className="md:max-w-2xl"
            headerIcon={<Sprout className="size-6" />}
            hudLayer
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    onClose();
                }
            }}
            open={open}
            showHeader
            title="OPGov Detaljan pregled"
        >
            <Stack spacing={4} className="min-w-0">
                <Typography level="body2" secondary>
                    Ovo su bilješke iz posljednjih detaljnih pregleda tvojih
                    gredica.
                </Typography>
                <Stack
                    spacing={3}
                    className="max-h-[55dvh] overflow-y-auto pr-1"
                >
                    {reports.map((report) => (
                        <Card
                            key={report.notificationId}
                            className="min-w-0 p-4"
                        >
                            <Stack spacing={2}>
                                <Row
                                    className="min-w-0 justify-between gap-3"
                                    alignItems="center"
                                >
                                    <Row className="min-w-0 gap-3">
                                        <RaisedBedReviewThumbnail
                                            report={report}
                                        />
                                        <Stack className="min-w-0" spacing={0}>
                                            <Typography
                                                className="min-w-0 break-words"
                                                level="body1"
                                                semiBold
                                            >
                                                {report.raisedBedName}
                                            </Typography>
                                            <time dateTime={report.inspectedAt}>
                                                <Typography
                                                    level="body3"
                                                    secondary
                                                >
                                                    {new Date(
                                                        report.inspectedAt,
                                                    ).toLocaleDateString(
                                                        'hr-HR',
                                                    )}
                                                </Typography>
                                            </time>
                                        </Stack>
                                    </Row>
                                    {report.assignedFarmer ? (
                                        <span
                                            aria-label={`Pregled obradio ${report.assignedFarmer.displayName}`}
                                            className="shrink-0"
                                            data-raised-bed-review-farmer
                                            role="img"
                                            title={`Pregled obradio ${report.assignedFarmer.displayName}`}
                                        >
                                            <UserAvatar
                                                avatarUrl={
                                                    report.assignedFarmer
                                                        .avatarUrl
                                                }
                                                displayName={
                                                    report.assignedFarmer
                                                        .displayName
                                                }
                                                size="md"
                                            />
                                        </span>
                                    ) : null}
                                </Row>
                                <Typography
                                    className="whitespace-pre-wrap break-words"
                                    level="body2"
                                >
                                    {report.notes ??
                                        'Pregled je završen bez dodatne bilješke.'}
                                </Typography>
                            </Stack>
                        </Card>
                    ))}
                </Stack>
                {dismissError ? (
                    <Alert color="warning">
                        <Stack spacing={2}>
                            <Typography level="body2">
                                Bilješke su prikazane, ali pregled nije označen
                                kao pročitan na drugim uređajima.
                            </Typography>
                            <Button
                                className="self-start"
                                loading={dismissPending}
                                onClick={onRetryDismiss}
                                size="sm"
                                variant="outlined"
                            >
                                Pokušaj ponovno
                            </Button>
                        </Stack>
                    </Alert>
                ) : null}
                <Row className="justify-end">
                    <Button onClick={onClose}>Zatvori</Button>
                </Row>
            </Stack>
        </GameModal>
    );
}
