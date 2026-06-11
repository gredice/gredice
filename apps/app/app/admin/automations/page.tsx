import {
    type AutomationDefinitionStatus,
    type AutomationRunStatus,
    automationDefinitionStatusValues,
    automationRunStatusValues,
    ensureDefaultAutomationDefinitions,
    getAutomationModuleMetadata,
    listAutomationDefinitions,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Add, Search } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { AdminPageHeader } from '../../../components/admin/navigation';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import { AutomationOverviewPanels } from './AutomationOverviewPanels';
import {
    automationQueuePageSize,
    listAutomationRunsPage,
    serializeAutomationDefinition,
} from './automationRunsData';
import {
    automationActionSummary,
    automationRunStatusMeta,
    automationStatusMeta,
    automationTriggerSummary,
    moduleMetadataByKey,
} from './presentation';

export const dynamic = 'force-dynamic';

type AutomationsSearchParams = {
    status?: string | string[];
    triggerEventType?: string | string[];
    runStatus?: string | string[];
    failedOnly?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function parseDefinitionStatus(
    value: string | string[] | undefined,
): AutomationDefinitionStatus | undefined {
    const status = firstParam(value);
    return automationDefinitionStatusValues.find((item) => item === status);
}

function parseRunStatus(
    value: string | string[] | undefined,
): AutomationRunStatus | undefined {
    const status = firstParam(value);
    return automationRunStatusValues.find((item) => item === status);
}

export default async function AutomationsPage({
    searchParams,
}: {
    searchParams: Promise<AutomationsSearchParams>;
}) {
    await auth(['admin']);
    await ensureDefaultAutomationDefinitions();

    const params = await searchParams;
    const definitionStatus = parseDefinitionStatus(params.status);
    const runStatus = parseRunStatus(params.runStatus);
    const triggerEventType =
        firstParam(params.triggerEventType)?.trim() || undefined;
    const failedOnly = firstParam(params.failedOnly) === '1';
    const modules = getAutomationModuleMetadata();
    const modulesByKey = moduleMetadataByKey(modules);
    const [definitions, runs] = await Promise.all([
        listAutomationDefinitions({
            status: definitionStatus,
            triggerEventType,
            limit: 200,
        }),
        listAutomationRunsPage({
            failedOnly,
            status: failedOnly ? 'failed' : runStatus,
            limit: automationQueuePageSize,
        }),
    ]);
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
            triggerSummary: automationTriggerSummary(
                definition.graph,
                modulesByKey,
            ),
        }),
    );

    return (
        <Stack spacing={5}>
            <AdminPageHeader
                actions={
                    <Button
                        href={KnownPages.AutomationCreate}
                        startDecorator={<Add className="size-4" />}
                    >
                        Nova automatizacija
                    </Button>
                }
            />

            <Stack spacing={1}>
                <Typography level="h4" component="h1">
                    Automatizacije
                </Typography>
                <Typography level="body2" className="text-muted-foreground">
                    Definicije, zadnja izvođenja i greške za asinkrone Gredice
                    tijekove rada.
                </Typography>
            </Stack>

            <Card>
                <CardContent>
                    <form className="grid gap-3 md:grid-cols-[160px_1fr_160px_auto] md:items-end">
                        <Stack spacing={1}>
                            <label
                                className="text-sm font-medium"
                                htmlFor="status"
                            >
                                Status
                            </label>
                            <select
                                id="status"
                                name="status"
                                defaultValue={definitionStatus ?? ''}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="">Svi</option>
                                {automationDefinitionStatusValues.map(
                                    (status) => (
                                        <option key={status} value={status}>
                                            {automationStatusMeta(status).label}
                                        </option>
                                    ),
                                )}
                            </select>
                        </Stack>
                        <Stack spacing={1}>
                            <label
                                className="text-sm font-medium"
                                htmlFor="triggerEventType"
                            >
                                Tip eventa okidača
                            </label>
                            <input
                                id="triggerEventType"
                                name="triggerEventType"
                                defaultValue={triggerEventType ?? ''}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                placeholder="raisedBedField.plantUpdate"
                            />
                        </Stack>
                        <Stack spacing={1}>
                            <label
                                className="text-sm font-medium"
                                htmlFor="runStatus"
                            >
                                Status izvođenja
                            </label>
                            <select
                                id="runStatus"
                                name="runStatus"
                                defaultValue={runStatus ?? ''}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="">Svi</option>
                                {automationRunStatusValues.map((status) => (
                                    <option key={status} value={status}>
                                        {automationRunStatusMeta(status).label}
                                    </option>
                                ))}
                            </select>
                        </Stack>
                        <Row spacing={2} className="items-center">
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    name="failedOnly"
                                    value="1"
                                    defaultChecked={failedOnly}
                                />
                                Samo greške
                            </label>
                            <Button
                                type="submit"
                                variant="outlined"
                                startDecorator={<Search className="size-4" />}
                            >
                                Filtriraj
                            </Button>
                        </Row>
                    </form>
                </CardContent>
            </Card>

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
                failedOnly={failedOnly}
                initialRunsPage={runs}
                runStatus={failedOnly ? 'failed' : runStatus}
            />
        </Stack>
    );
}
