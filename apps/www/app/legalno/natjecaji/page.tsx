import { slugify } from '@gredice/js/slug';
import { Card, CardContent, CardHeader } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Container } from '@gredice/ui/Container';
import { Navigate, Timer } from '@gredice/ui/icons';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata, Route } from 'next';
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
            <Stack spacing={8}>
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
                    <Stack spacing={4}>
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
                                            spacing={4}
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
                                        <Row spacing={2}>
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
