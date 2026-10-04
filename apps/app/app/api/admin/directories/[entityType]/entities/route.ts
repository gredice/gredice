import {
    directoryEntityListPageSize,
    listDirectoryEntitiesPage,
    normalizeDirectoryEntitySortDirection,
    normalizeDirectoryEntitySortKey,
    parseDirectoryEntityOperationIds,
} from '../../../../../../app/admin/directories/[entityType]/directoryEntityListData';
import { withAuth } from '../../../../../../lib/auth/auth';

export const dynamic = 'force-dynamic';

function parseInteger(value: string | null, fallback: number) {
    if (!value) {
        return fallback;
    }

    const parsed = Number(value);

    return Number.isInteger(parsed) ? parsed : fallback;
}

export async function GET(
    request: Request,
    {
        params,
    }: {
        params: Promise<{ entityType: string }>;
    },
) {
    return await withAuth(['admin'], async () => {
        const { entityType } = await params;
        const searchParams = new URL(request.url).searchParams;
        const page = await listDirectoryEntitiesPage({
            entityTypeName: entityType,
            completion: searchParams.get('completion') ?? '',
            state: searchParams.get('state') ?? '',
            operationIds: parseDirectoryEntityOperationIds(
                searchParams.get('operations') ?? undefined,
            ),
            search: searchParams.get('search') ?? '',
            sort: {
                key: normalizeDirectoryEntitySortKey(searchParams.get('sort')),
                direction: normalizeDirectoryEntitySortDirection(
                    searchParams.get('direction'),
                ),
            },
            limit: parseInteger(
                searchParams.get('limit'),
                directoryEntityListPageSize,
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
