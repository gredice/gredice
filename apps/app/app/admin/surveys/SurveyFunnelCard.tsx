import type { SurveyAnalyticsAdminResult } from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Warning } from '@gredice/ui/icons';
import { Progress } from '@gredice/ui/Progress';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import { formatSurveyAnalyticsRate } from './surveyAnalyticsPresentation';

const snapshotFormatter = new Intl.DateTimeFormat('hr-HR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Zagreb',
});

export function SurveyFunnelCard({
    analytics,
}: {
    analytics: SurveyAnalyticsAdminResult;
}) {
    const denominator = analytics.funnel.assigned;
    const milestones = [
        {
            label: 'Dodijeljeno',
            count: analytics.funnel.assigned,
            rate: denominator > 0 ? 1 : null,
        },
        {
            label: 'Otvorilo',
            count: analytics.funnel.reachedOpened,
            rate: analytics.funnel.openRate,
        },
        {
            label: 'Započelo',
            count: analytics.funnel.reachedStarted,
            rate: analytics.funnel.startRate,
        },
        {
            label: 'Predalo',
            count: analytics.funnel.reachedSubmitted,
            rate: analytics.funnel.responseRate,
        },
    ];
    const states = [
        {
            label: 'Na čekanju, nije otvoreno',
            count: analytics.funnel.unopened,
        },
        {
            label: 'Na čekanju, otvoreno',
            count: analytics.funnel.opened,
        },
        {
            label: 'Započeto, nije predano',
            count: analytics.funnel.started,
        },
        {
            label: 'Predano',
            count: analytics.funnel.submitted,
        },
        {
            label: 'Isteklo',
            count: analytics.funnel.expired,
        },
        {
            label: 'Otkazano',
            count: analytics.funnel.canceled,
        },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tok angažmana</CardTitle>
                <Typography level="body3" className="text-muted-foreground">
                    Doseg se računa od {denominator.toLocaleString('hr-HR')}{' '}
                    dodjela. Istek je učinkovito stanje na{' '}
                    {snapshotFormatter.format(analytics.asOf)}.
                </Typography>
            </CardHeader>
            <CardContent>
                <Stack spacing={4}>
                    {!analytics.funnel.reconciles ? (
                        <Alert color="warning" startDecorator={<Warning />}>
                            Stanja dodjela ne zbrajaju se na ukupan broj
                            dodjela. Provjeri izvorne statuse.
                        </Alert>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {milestones.map((milestone) => (
                            <Stack key={milestone.label} spacing={1}>
                                <div className="flex items-baseline justify-between gap-2">
                                    <Typography semiBold>
                                        {milestone.label}
                                    </Typography>
                                    <Typography
                                        level="body2"
                                        className="tabular-nums"
                                    >
                                        {milestone.count.toLocaleString(
                                            'hr-HR',
                                        )}{' '}
                                        ·{' '}
                                        {formatSurveyAnalyticsRate(
                                            milestone.rate,
                                        )}
                                    </Typography>
                                </div>
                                <Progress
                                    aria-label={`${milestone.label}: ${milestone.count.toLocaleString(
                                        'hr-HR',
                                    )} od ${denominator.toLocaleString(
                                        'hr-HR',
                                    )} dodjela`}
                                    value={
                                        milestone.rate === null
                                            ? undefined
                                            : milestone.rate * 100
                                    }
                                />
                            </Stack>
                        ))}
                    </div>

                    <div>
                        <Typography level="body2" semiBold className="mb-2">
                            Trenutačna isključiva stanja
                        </Typography>
                        <Table>
                            <caption className="sr-only">
                                Isključiva stanja dodjela i udio od svih dodjela
                            </caption>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head scope="col">Stanje</Table.Head>
                                    <Table.Head
                                        scope="col"
                                        className="text-right"
                                    >
                                        Broj
                                    </Table.Head>
                                    <Table.Head
                                        scope="col"
                                        className="text-right"
                                    >
                                        Udio dodjela
                                    </Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {states.map((state) => (
                                    <Table.Row key={state.label}>
                                        <Table.Cell>{state.label}</Table.Cell>
                                        <Table.Cell className="text-right tabular-nums">
                                            {state.count.toLocaleString(
                                                'hr-HR',
                                            )}
                                        </Table.Cell>
                                        <Table.Cell className="text-right tabular-nums">
                                            {formatSurveyAnalyticsRate(
                                                denominator > 0
                                                    ? state.count / denominator
                                                    : null,
                                            )}
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                                <Table.Row>
                                    <Table.Cell className="font-semibold">
                                        Ukupno
                                    </Table.Cell>
                                    <Table.Cell className="text-right font-semibold tabular-nums">
                                        {analytics.funnel.stateTotal.toLocaleString(
                                            'hr-HR',
                                        )}
                                    </Table.Cell>
                                    <Table.Cell className="text-right font-semibold tabular-nums">
                                        {formatSurveyAnalyticsRate(
                                            denominator > 0 ? 1 : null,
                                        )}
                                    </Table.Cell>
                                </Table.Row>
                            </Table.Body>
                        </Table>
                    </div>
                </Stack>
            </CardContent>
        </Card>
    );
}
