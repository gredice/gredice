import {
    type AutomationDefinitionStatus,
    type AutomationRunStatus,
    automationDefinitionStatusValues,
    automationRunStatusValues,
    ensureDefaultAutomationDefinitions,
    getAutomationModuleMetadata,
    listAutomationDefinitions,
    listAutomationRuns,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Add, Search } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { AdminPageHeader } from '../../../components/admin/navigation';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
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

function StatusChip({ status }: { status: AutomationDefinitionStatus }) {
    const meta = automationStatusMeta(status);
    return (
        <Chip color={meta.color} size="sm" variant="soft">
            {meta.label}
        </Chip>
    );
}

function RunStatusChip({ status }: { status: AutomationRunStatus }) {
    const meta = automationRunStatusMeta(status);
    return (
        <Chip color={meta.color} size="sm" variant="soft">
            {meta.label}
        </Chip>
    );
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
        listAutomationRuns({
            status: failedOnly ? 'failed' : runStatus,
            limit: 300,
        }),
    ]);
    const runsByDefinitionId = new Map<number, typeof runs>();

    for (const run of runs) {
        const definitionRuns = runsByDefinitionId.get(
            run.automationDefinitionId,
        );
        if (definitionRuns) {
            definitionRuns.push(run);
        } else {
            runsByDefinitionId.set(run.automationDefinitionId, [run]);
        }
    }

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
                    workflowe.
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
                                Trigger event
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
                                Run status
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

            <div className="grid gap-4 md:grid-cols-4">
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
                            Recent runs
                        </Typography>
                        <Typography level="h4">{runs.length}</Typography>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <Typography level="body3" secondary>
                            Greške
                        </Typography>
                        <Typography level="h4">
                            {
                                runs.filter((run) => run.status === 'failed')
                                    .length
                            }
                        </Typography>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Definicije</CardTitle>
                </CardHeader>
                <CardOverflow>
                    <div className="overflow-auto">
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>Naziv</Table.Head>
                                    <Table.Head>Status</Table.Head>
                                    <Table.Head>Trigger</Table.Head>
                                    <Table.Head>Akcije</Table.Head>
                                    <Table.Head>Zadnji run</Table.Head>
                                    <Table.Head>Greške</Table.Head>
                                    <Table.Head>Ažurirano</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {definitions.length === 0 ? (
                                    <Table.Row>
                                        <Table.Cell colSpan={7}>
                                            <NoDataPlaceholder>
                                                Nema automatizacija za odabrane
                                                filtere.
                                            </NoDataPlaceholder>
                                        </Table.Cell>
                                    </Table.Row>
                                ) : null}
                                {definitions.map((definition) => {
                                    const definitionRuns =
                                        runsByDefinitionId.get(definition.id) ??
                                        [];
                                    const latestRun = definitionRuns[0];
                                    const failedCount = definitionRuns.filter(
                                        (run) => run.status === 'failed',
                                    ).length;

                                    return (
                                        <Table.Row key={definition.id}>
                                            <Table.Cell>
                                                <Stack spacing={1}>
                                                    <Link
                                                        href={KnownPages.Automation(
                                                            definition.id,
                                                        )}
                                                        className="font-medium text-primary hover:underline"
                                                    >
                                                        {definition.name}
                                                    </Link>
                                                    <Typography
                                                        level="body3"
                                                        className="text-muted-foreground"
                                                    >
                                                        {definition.key}
                                                    </Typography>
                                                </Stack>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <StatusChip
                                                    status={definition.status}
                                                />
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Typography level="body3">
                                                    {automationTriggerSummary(
                                                        definition.graph,
                                                        modulesByKey,
                                                    )}
                                                </Typography>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Typography level="body3">
                                                    {automationActionSummary(
                                                        definition.graph,
                                                        modulesByKey,
                                                    )}
                                                </Typography>
                                            </Table.Cell>
                                            <Table.Cell>
                                                {latestRun ? (
                                                    <Stack spacing={1}>
                                                        <RunStatusChip
                                                            status={
                                                                latestRun.status
                                                            }
                                                        />
                                                        <LocalDateTime>
                                                            {
                                                                latestRun.createdAt
                                                            }
                                                        </LocalDateTime>
                                                    </Stack>
                                                ) : (
                                                    <Typography
                                                        level="body3"
                                                        className="text-muted-foreground"
                                                    >
                                                        Nema izvođenja
                                                    </Typography>
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {failedCount}
                                            </Table.Cell>
                                            <Table.Cell>
                                                <LocalDateTime>
                                                    {definition.updatedAt}
                                                </LocalDateTime>
                                            </Table.Cell>
                                        </Table.Row>
                                    );
                                })}
                            </Table.Body>
                        </Table>
                    </div>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
