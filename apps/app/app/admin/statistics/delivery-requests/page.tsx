import { getDeliveryRequestsSummary } from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Warning } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    AdminPageHeader,
    AdminPageTitle,
} from '../../../../components/admin/navigation';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../../lib/auth/auth';
import { DeliveryRequestStatisticsCharts } from './DeliveryRequestStatisticsCharts';
import {
    buildDeliveryRequestStatistics,
    type DeliveryRequestStatistics,
} from './deliveryRequestStatistics';

export const dynamic = 'force-dynamic';

export default async function DeliveryRequestStatisticsPage() {
    await auth(['admin']);

    let statistics: DeliveryRequestStatistics | null = null;
    try {
        const requests = await getDeliveryRequestsSummary();
        statistics = buildDeliveryRequestStatistics(requests);
    } catch {
        // Keep database and event reconstruction details private while giving
        // operators a recoverable page state.
    }

    const summaryCards = statistics
        ? [
              {
                  label: 'Ukupno zahtjeva',
                  value: statistics.summary.totalRequests.toString(),
                  detail: `${statistics.summary.assignedRequests} s odabranim terminom`,
              },
              {
                  label: 'Grupirane dostave',
                  value: statistics.summary.totalDeliveries.toString(),
                  detail: `${statistics.summary.uniqueSlots} korištena termina`,
              },
              {
                  label: 'Zahtjeva po dostavi',
                  value: statistics.summary.averageRequestsPerDelivery.toLocaleString(
                      'hr-HR',
                      {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                      },
                  ),
                  detail: 'Prosjek po korisniku i terminu',
              },
              {
                  label: 'Dostave s više zahtjeva',
                  value: statistics.summary.multiRequestDeliveries.toString(),
                  detail: `${statistics.summary.multiRequestDeliveryRate}% grupiranih · najviše ${statistics.summary.largestDeliverySize}`,
              },
              {
                  label: 'Ispunjeno',
                  value: statistics.summary.fulfilledRequests.toString(),
                  detail: `${statistics.summary.completionRate}% svih zahtjeva`,
              },
              {
                  label: 'Otkazano',
                  value: statistics.summary.cancelledRequests.toString(),
                  detail: `${statistics.summary.cancellationRate}% svih zahtjeva`,
              },
          ]
        : [];

    return (
        <Stack spacing={4}>
            <AdminPageTitle title="Statistika zahtjeva za dostavu" />
            <AdminPageHeader />

            <Stack spacing={2}>
                <Typography level="h3" component="h1">
                    Statistika zahtjeva za dostavu
                </Typography>
                <Typography level="body2" className="text-muted-foreground">
                    Zahtjevi, grupirane dostave te potražnja po danima i vremenu
                    uz pregled trendova i ishoda.
                </Typography>
                <div>
                    <Chip color="neutral" variant="soft">
                        Cijelo razdoblje
                    </Chip>
                </div>
            </Stack>

            {!statistics && (
                <Alert color="danger" startDecorator={<Warning />}>
                    Statistički podaci dostave trenutačno nisu dostupni. Pokušaj
                    ponovno.
                </Alert>
            )}

            {statistics?.summary.totalRequests === 0 && (
                <Card>
                    <CardOverflow className="p-4">
                        <NoDataPlaceholder>
                            Nema zahtjeva za dostavu za statistički prikaz.
                        </NoDataPlaceholder>
                    </CardOverflow>
                </Card>
            )}

            {statistics && statistics.summary.totalRequests > 0 && (
                <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        {summaryCards.map((card) => (
                            <Card key={card.label}>
                                <CardOverflow>
                                    <Stack spacing={2} className="p-4">
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            {card.label}
                                        </Typography>
                                        <Typography
                                            level="h2"
                                            className="tabular-nums"
                                        >
                                            {card.value}
                                        </Typography>
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            {card.detail}
                                        </Typography>
                                    </Stack>
                                </CardOverflow>
                            </Card>
                        ))}
                    </div>

                    <DeliveryRequestStatisticsCharts statistics={statistics} />
                </>
            )}
        </Stack>
    );
}
