import {
    type AutomationRunStatus,
    automationRunStatusValues,
} from '@gredice/storage';
import { withAuth } from '../../../../../lib/auth/auth';
import {
    automationQueuePageSize,
    listAutomationRunsPage,
} from '../../../../admin/automations/automationRunsData';

export const dynamic = 'force-dynamic';

function parseAutomationRunStatus(
    value: string | null,
): AutomationRunStatus | undefined {
    return automationRunStatusValues.find((status) => status === value);
}

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
        const page = await listAutomationRunsPage({
            failedOnly: searchParams.get('failedOnly') === '1',
            limit: parseInteger(
                searchParams.get('limit'),
                automationQueuePageSize,
            ),
            offset: Math.max(0, parseInteger(searchParams.get('offset'), 0)),
            status: parseAutomationRunStatus(searchParams.get('runStatus')),
        });

        return Response.json(page, {
            headers: {
                'Cache-Control': 'no-store',
            },
        });
    });
}
