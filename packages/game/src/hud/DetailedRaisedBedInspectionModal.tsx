'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card } from '@gredice/ui/Card';
import { Sprout } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { DetailedRaisedBedInspectionReport } from '../hooks/useDetailedRaisedBedInspectionReports';
import { GameModal } from '../shared-ui/game-modal';

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
    const raisedBedCount = new Set(reports.map((report) => report.raisedBedId))
        .size;

    return (
        <GameModal
            className="md:max-w-2xl"
            headerDescription={`Broj pregledanih gredica: ${raisedBedCount.toString()}`}
            headerIcon={<Sprout className="size-6" />}
            hudLayer
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    onClose();
                }
            }}
            open={open}
            showHeader
            title="Farmerov detaljan pregled"
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
                                    alignItems="start"
                                >
                                    <Typography
                                        className="min-w-0 break-words"
                                        level="body1"
                                        semiBold
                                    >
                                        {report.raisedBedName}
                                    </Typography>
                                    <time
                                        className="shrink-0"
                                        dateTime={report.inspectedAt}
                                    >
                                        <Typography level="body3" secondary>
                                            {new Date(
                                                report.inspectedAt,
                                            ).toLocaleDateString('hr-HR')}
                                        </Typography>
                                    </time>
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
