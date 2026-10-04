import {
    type AutomationGraph,
    automationModuleKeys,
    defaultAutomationMaxConcurrentRuns,
    getAutomationModuleMetadata,
    maxAutomationMaxConcurrentRuns,
} from '@gredice/storage';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { auth } from '../../../../lib/auth/auth';
import { AutomationFlowEditor } from '../AutomationFlowEditor';

export const dynamic = 'force-dynamic';

const initialGraph: AutomationGraph = {
    nodes: [
        {
            id: 'trigger-domain-event',
            moduleKey: automationModuleKeys.triggerDomainEvent,
            kind: 'trigger',
            position: { x: 80, y: 160 },
            config: {},
        },
        {
            id: 'action-log',
            moduleKey: automationModuleKeys.actionLog,
            kind: 'action',
            position: { x: 420, y: 160 },
            config: {
                message: 'Automatizacija je došla do koraka zapisa.',
            },
        },
    ],
    edges: [
        {
            id: 'edge-trigger-domain-event-action-log',
            source: 'trigger-domain-event',
            target: 'action-log',
        },
    ],
};

export default async function AutomationCreatePage() {
    await auth(['admin']);

    return (
        <Stack spacing={4}>
            <AdminPageHeader />
            <Stack spacing={1}>
                <Typography level="h4" component="h1">
                    Nova automatizacija
                </Typography>
                <Typography level="body2" className="text-muted-foreground">
                    Sastavite tijek rada iz dostupnih okidača, uvjeta i akcija.
                </Typography>
            </Stack>
            <AutomationFlowEditor
                initialKey=""
                initialName="Nova automatizacija"
                initialDescription={null}
                initialStatus="draft"
                initialMaxConcurrentRuns={defaultAutomationMaxConcurrentRuns}
                maxConcurrentRunsLimit={maxAutomationMaxConcurrentRuns}
                initialGraph={initialGraph}
                modules={getAutomationModuleMetadata()}
            />
        </Stack>
    );
}
