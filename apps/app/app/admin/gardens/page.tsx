import { getGardens } from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { auth } from '../../../lib/auth/auth';
import { getDateFromTimeFilter } from '../../../lib/utils/timeFilters';
import { GardensFilters } from './GardensFilters';
import { GardensTable } from './GardensTable';

export const dynamic = 'force-dynamic';

export default async function GardensPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);
    const params = await searchParams;

    // Get filter parameters
    const fromFilter =
        typeof params.from === 'string' ? params.from : 'last-30-days';
    const fromDate = getDateFromTimeFilter(fromFilter);

    // Get all gardens
    const allGardens = await getGardens();

    // Apply filters
    let filteredGardens = allGardens;

    // Apply date filter
    if (fromDate) {
        filteredGardens = filteredGardens.filter((garden) => {
            return garden.createdAt && garden.createdAt >= fromDate;
        });
    }

    return (
        <Stack spacing={4}>
            <Row spacing={2}>
                <Chip color="primary">{filteredGardens.length}</Chip>
            </Row>

            <GardensFilters />

            <Card>
                <CardOverflow>
                    <GardensTable gardens={filteredGardens} />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
