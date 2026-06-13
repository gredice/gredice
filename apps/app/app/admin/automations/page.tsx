import {
    type AutomationDefinitionStatus,
    automationDefinitionStatusValues,
    automationRunStatusValues,
    ensureDefaultAutomationDefinitions,
    getAutomationModuleMetadata,
    listAutomationDefinitionRunSummaries,
    listAutomationDefinitions,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Add } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { redirect } from 'next/navigation';
import { AdminPageHeader } from '../../../components/admin/navigation';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import { AutomationFilters } from './AutomationFilters';
import { AutomationOverviewPanels } from './AutomationOverviewPanels';
import {
    normalizeAutomationRunStatusFilter,
    statusesForAutomationRunFilter,
} from './automationRunFilters';
import {
    automationQueuePageSize,
    listAutomationRunsPage,
    serializeAutomationDefinition,
} from './automationRunsData';
import {
    automationActionSummary,
    automationTriggerSummary,
    moduleMetadataByKey,
} from './presentation';

export const dynamic = 'force-dynamic';

type AutomationsSearchParams = {
    failedOnly?: string | string[];
    status?: string | string[];
    triggerEventType?: string | string[];
    runStatus?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function appendSearchParam(
    searchParams: URLSearchParams,
    key: string,
    value: string | string[] | undefined,
) {
    if (Array.isArray(value)) {
        value.forEach((item) => {
            searchParams.append(key, item);
        });
        return;
    }

    if (value !== undefined) {
        searchParams.set(key, value);
    }
}

function legacyFailedOnlyRedirectUrl(params: AutomationsSearchParams) {
    if (firstParam(params.failedOnly) !== '1') {
        return null;
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (key === 'failedOnly' || key === 'runStatus') {
            return;
        }

        appendSearchParam(searchParams, key, value);
    });
    searchParams.set('runStatus', 'failed');

    const query = searchParams.toString();
    return `/admin/automations${query ? `?${query}` : ''}`;
}

function parseDefinitionStatusFilter(
    value: string | string[] | undefined,
): AutomationDefinitionStatus | 'all' {
    const status = firstParam(value);
    if (status === 'all') {
        return 'all';
    }

    return (
        automationDefinitionStatusValues.find((item) => item === status) ??
        'enabled'
    );
}

export default async function AutomationsPage({
    searchParams,
}: {
    searchParams: Promise<AutomationsSearchParams>;
}) {
    const params = await searchParams;
    const redirectUrl = legacyFailedOnlyRedirectUrl(params);
    if (redirectUrl) {
        redirect(redirectUrl);
    }

    await auth(['admin']);
    await ensureDefaultAutomationDefinitions();

    const definitionStatusFilter = parseDefinitionStatusFilter(params.status);
    const definitionStatus =
        definitionStatusFilter === 'all' ? undefined : definitionStatusFilter;
    const runStatusFilter = normalizeAutomationRunStatusFilter(
        firstParam(params.runStatus),
    );
    const runStatus = statusesForAutomationRunFilter(runStatusFilter);
    const triggerEventType =
        firstParam(params.triggerEventType)?.trim() || undefined;
    const modules = getAutomationModuleMetadata();
    const modulesByKey = moduleMetadataByKey(modules);
    const [definitions, runs] = await Promise.all([
        listAutomationDefinitions({
            status: definitionStatus,
            triggerEventType,
            limit: 200,
        }),
        listAutomationRunsPage({
            status: runStatus,
            limit: automationQueuePageSize,
        }),
    ]);
    const runSummaries = await listAutomationDefinitionRunSummaries(
        definitions.map((definition) => definition.id),
    );
    const runSummariesByDefinitionId = new Map(
        runSummaries.map((summary) => [
            summary.automationDefinitionId,
            summary,
        ]),
    );
    const queuedRunsCount = runs.runs.filter(
        (run) => run.status === 'queued' || run.status === 'retrying',
    ).length;
    const runningRunsCount = runs.runs.filter(
        (run) => run.status === 'running',
    ).length;
    const definitionItems = definitions.map((definition) =>
        serializeAutomationDefinition({
            actionSummary: automationActionSummary(
                definition.graph,
                modulesByKey,
            ),
            definition,
            runSummary: runSummariesByDefinitionId.get(definition.id),
            triggerSummary: automationTriggerSummary(
                definition.graph,
                modulesByKey,
            ),
        }),
    );

    return (
        <Stack spacing={4}>
            <AdminPageHeader
                heading="Automatizacije"
                actions={
                    <Button
                        href={KnownPages.AutomationCreate}
                        startDecorator={<Add className="size-4" />}
                    >
                        Nova automatizacija
                    </Button>
                }
            />

            <AutomationFilters
                definitionStatuses={[...automationDefinitionStatusValues]}
                runStatuses={[...automationRunStatusValues]}
            />

            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <Card>
                    <CardContent>
                        <Typography level="body3" secondary>
                            Definicije
                        </Typography>
                        <Typography level="h4">{definitions.length}</Typography>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <Typography level="body3" secondary>
                            Uključene
                        </Typography>
                        <Typography level="h4">
                            {
                                definitions.filter(
                                    (definition) =>
                                        definition.status === 'enabled',
                                ).length
                            }
                        </Typography>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <Typography level="body3" secondary>
                            Učitani poslovi
                        </Typography>
                        <Typography level="h4">
                            {runs.hasMore
                                ? `${runs.runs.length}+`
                                : runs.runs.length}
                        </Typography>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <Typography level="body3" secondary>
                            Čeka
                        </Typography>
                        <Typography level="h4">{queuedRunsCount}</Typography>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <Typography level="body3" secondary>
                            U tijeku
                        </Typography>
                        <Typography level="h4">{runningRunsCount}</Typography>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <Typography level="body3" secondary>
                            Greške
                        </Typography>
                        <Typography level="h4">
                            {
                                runs.runs.filter(
                                    (run) => run.status === 'failed',
                                ).length
                            }
                        </Typography>
                    </CardContent>
                </Card>
            </div>

            <AutomationOverviewPanels
                definitions={definitionItems}
                initialRunsPage={runs}
                runStatusFilter={runStatusFilter}
            />
        </Stack>
    );
}
