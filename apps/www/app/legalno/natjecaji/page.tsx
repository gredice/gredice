import { slugify } from '@gredice/js/slug';
import { Navigate, Timer } from '@signalco/ui-icons';
import { Card, CardContent, CardHeader } from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Container } from '@signalco/ui-primitives/Container';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata, Route } from 'next';
import { PageHeader } from '../../../components/shared/PageHeader';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { getOccasionsData } from '../../../lib/occasions/getOccasionsData';

export const metadata: Metadata = {
    title: 'Natječaji',
    description: 'Pregled svih natječaja i nagradnih igara.',
};

function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('hr-HR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export default async function OccasionsListPage() {
    const occasions = (await getOccasionsData()) ?? [];
    const now = new Date();

    return (
        <Container maxWidth="sm">
            <Stack spacing={4}>
                <PageHeader
                    padded
                    header="Natječaji"
                    subHeader="Pregled svih natječaja i nagradnih igara."
                />

                {occasions.length === 0 ? (
                    <NoDataPlaceholder>
                        Trenutno nema dostupnih natječaja.
                    </NoDataPlaceholder>
                ) : (
                    <Stack spacing={2}>
                        {occasions.map((occasion) => {
                            const endDate = occasion.information.endDate
                                ? new Date(occasion.information.endDate)
                                : null;
                            const startDate = new Date(
                                occasion.information.startDate,
                            );
                            const isExpired = endDate ? now > endDate : false;
                            const hasStarted = now >= startDate;
                            const href =
                                `/legalno/natjecaji/${slugify(occasion.information.name)}` as Route;

                            const formattedStartDate = formatDate(
                                occasion.information.startDate,
                            );
                            const formattedEndDate = occasion.information
                                .endDate
                                ? formatDate(occasion.information.endDate)
                                : null;

                            return (
                                <Card
                                    className="hover:bg-muted/50 transition-colors"
                                    key={occasion.id}
                                    href={href}
                                >
                                    <CardHeader>
                                        <Row
                                            spacing={2}
                                            justifyContent="space-between"
                                        >
                                            <Typography semiBold>
                                                {occasion.information.name}
                                            </Typography>
                                            <Chip
                                                color={
                                                    isExpired
                                                        ? 'neutral'
                                                        : hasStarted
                                                          ? 'success'
                                                          : 'warning'
                                                }
                                            >
                                                {isExpired
                                                    ? 'Završeno'
                                                    : hasStarted
                                                      ? 'U tijeku'
                                                      : 'Uskoro'}
                                            </Chip>
                                        </Row>
                                    </CardHeader>
                                    <CardContent>
                                        <Row spacing={1}>
                                            <Timer className="size-5 shrink-0 opacity-60" />
                                            <Typography level="body2">
                                                {formattedStartDate}
                                            </Typography>
                                            {formattedEndDate && (
                                                <>
                                                    <Navigate className="size-5 shrink-0 opacity-60" />
                                                    <Typography level="body2">
                                                        {formattedEndDate}
                                                    </Typography>
                                                </>
                                            )}
                                        </Row>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </Stack>
                )}
            </Stack>
        </Container>
    );
}
