import { withAuth } from '../../../../lib/auth/auth';
import { getDateFromTimeFilter } from '../../../../lib/utils/timeFilters';
import {
    listOperationsPage,
    normalizeOperationsListSortDirection,
    normalizeOperationsListSortKey,
    operationsListPageSize,
} from '../../../admin/operations/operationsListData';

export const dynamic = 'force-dynamic';

function parseInteger(value: string | null, fallback: number) {
    if (!value) {
        return fallback;
    }

    const parsed = Number(value);

    return Number.isInteger(parsed) ? parsed : fallback;
}

export async function GET(request: Request) {
    return await withAuth(['admin'], async () => {
        const searchParams = new URL(request.url).searchParams;
        const page = await listOperationsPage({
            fromDate: getDateFromTimeFilter(
                searchParams.get('from') ?? 'last-14-days',
            ),
            sort: {
                key: normalizeOperationsListSortKey(searchParams.get('sort')),
                direction: normalizeOperationsListSortDirection(
                    searchParams.get('direction'),
                ),
            },
            limit: parseInteger(
                searchParams.get('limit'),
                operationsListPageSize,
            ),
            offset: Math.max(0, parseInteger(searchParams.get('offset'), 0)),
        });

        return Response.json(page, {
            headers: {
                'Cache-Control': 'no-store',
            },
        });
    });
}
