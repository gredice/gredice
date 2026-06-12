'use client';

import '@xyflow/react/dist/style.css';

import { slugify } from '@gredice/js/slug';
import type {
    AutomationDefinitionStatus,
    AutomationGraph,
    AutomationJsonObject,
    AutomationModuleKind,
    AutomationModuleMetadata,
} from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import {
    Add,
    AI,
    Calendar,
    Channel,
    CircleEqual,
    Configuration,
    Droplets,
    Filter,
    Hammer,
    Lightning,
    ListTodo,
    Play,
    Settings,
    Sprout,
    Store,
    Text,
} from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import {
    addEdge,
    Background,
    Controls,
    type Edge,
    Handle,
    MarkerType,
    type Node,
    type NodeChange,
    type NodeProps,
    type OnConnect,
    Position,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';
import { useRouter } from 'next/navigation';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition,
} from 'react';
import { AdminPageHeader } from '../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { KnownPages } from '../../../src/KnownPages';
import { AutomationActionsMenu } from './AutomationActionsMenu';
import { AutomationSlidePanel } from './AutomationSlidePanel';
import {
    type AutomationSaveResult,
    saveAutomationDefinitionAction,
    updateAutomationStatusAction,
} from './actions';
import {
    automationConfigFieldDescription,
    automationConfigFieldLabel,
    automationConfigFieldOptionLabel,
    automationConfigFieldPlaceholder,
    automationModuleDescription,
    automationModuleInputDescription,
    automationModuleKeys,
    automationModuleKindLabel,
    automationModuleOutputDescription,
    automationModuleTitle,
    automationStatusMeta,
} from './presentation';

type FlowNodeData = Record<string, unknown> & {
    moduleKey: string;
    kind: AutomationModuleKind;
    config: AutomationJsonObject;
    label: string;
    description: string;
};

type FlowNode = Node<FlowNodeData>;
type AutomationEditorPanel = 'details' | 'modules' | 'settings' | 'testing';
type AutosaveStatus = 'saved' | 'unsaved' | 'saving' | 'failed';
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type AutomationFlowEditorProps = {
    automationId?: number;
    initialKey: string;
    initialName: string;
    initialDescription: string | null;
    initialStatus: AutomationDefinitionStatus;
    initialMaxConcurrentRuns: number;
    maxConcurrentRunsLimit: number;
    initialGraph: AutomationGraph;
    modules: AutomationModuleMetadata[];
    testPanel?: ReactNode;
};

function kindLabel(kind: AutomationModuleKind) {
    return automationModuleKindLabel(kind);
}

const automationNodeKindTheme = {
    trigger: {
        accent: 'bg-cyan-500 dark:bg-cyan-400',
        badge: 'bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200',
        handle: '!border-cyan-300 !bg-cyan-500 dark:!border-cyan-700 dark:!bg-cyan-400',
        icon: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200',
        node: 'border-cyan-200/80 bg-white text-slate-950 shadow-cyan-950/5 dark:border-cyan-900/70 dark:bg-neutral-950 dark:text-neutral-100',
        selected:
            'ring-2 ring-cyan-500/70 ring-offset-2 ring-offset-background dark:ring-cyan-300/70',
    },
    filter: {
        accent: 'bg-sky-500 dark:bg-sky-400',
        badge: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
        handle: '!border-sky-300 !bg-sky-500 dark:!border-sky-700 dark:!bg-sky-400',
        icon: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
        node: 'border-sky-200/80 bg-white text-slate-950 shadow-sky-950/5 dark:border-sky-900/70 dark:bg-neutral-950 dark:text-neutral-100',
        selected:
            'ring-2 ring-sky-500/70 ring-offset-2 ring-offset-background dark:ring-sky-300/70',
    },
    condition: {
        accent: 'bg-amber-500 dark:bg-amber-400',
        badge: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
        handle: '!border-amber-300 !bg-amber-500 dark:!border-amber-700 dark:!bg-amber-400',
        icon: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
        node: 'border-amber-200/80 bg-white text-slate-950 shadow-amber-950/5 dark:border-amber-900/70 dark:bg-neutral-950 dark:text-neutral-100',
        selected:
            'ring-2 ring-amber-500/70 ring-offset-2 ring-offset-background dark:ring-amber-300/70',
    },
    action: {
        accent: 'bg-emerald-500 dark:bg-emerald-400',
        badge: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
        handle: '!border-emerald-300 !bg-emerald-500 dark:!border-emerald-700 dark:!bg-emerald-400',
        icon: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
        node: 'border-emerald-200/80 bg-white text-slate-950 shadow-emerald-950/5 dark:border-emerald-900/70 dark:bg-neutral-950 dark:text-neutral-100',
        selected:
            'ring-2 ring-emerald-500/70 ring-offset-2 ring-offset-background dark:ring-emerald-300/70',
    },
} satisfies Record<
    AutomationModuleKind,
    {
        accent: string;
        badge: string;
        handle: string;
        icon: string;
        node: string;
        selected: string;
    }
>;

const automationKindIcons = {
    trigger: Lightning,
    filter: Filter,
    condition: CircleEqual,
    action: Play,
} satisfies Record<AutomationModuleKind, IconComponent>;

const automationModuleIcons = new Map<string, IconComponent>([
    [automationModuleKeys.triggerDomainEvent, Channel],
    [automationModuleKeys.triggerScheduleMonthly, Calendar],
    [automationModuleKeys.conditionEventDataEquals, CircleEqual],
    [automationModuleKeys.conditionOperationMatches, ListTodo],
    [automationModuleKeys.conditionPlantStatusEquals, Sprout],
    [automationModuleKeys.actionQueueSeasonalSowingOfferOperations, Droplets],
    [automationModuleKeys.actionCreateOperation, Hammer],
    [automationModuleKeys.actionCreateFarmInventoryOperations, Store],
    [automationModuleKeys.actionUpdateRaisedBedFieldPlantAttributes, Sprout],
    [automationModuleKeys.actionCreatePlantStatusRequestsFromImageAnalysis, AI],
    [automationModuleKeys.actionLog, Text],
]);

function automationNodeIcon(moduleKey: string, kind: AutomationModuleKind) {
    return automationModuleIcons.get(moduleKey) ?? automationKindIcons[kind];
}

function ModuleIconBadge({
    kind,
    moduleKey,
}: {
    kind: AutomationModuleKind;
    moduleKey: string;
}) {
    const Icon = automationNodeIcon(moduleKey, kind);
    return (
        <span
            className={cx(
                'flex size-9 shrink-0 items-center justify-center rounded-md',
                automationNodeKindTheme[kind].icon,
            )}
        >
            <Icon className="size-4" aria-hidden="true" />
        </span>
    );
}

function AutomationFlowNode({ data, selected }: NodeProps<FlowNode>) {
    const theme = automationNodeKindTheme[data.kind];

    return (
        <div
            className={cx(
                'relative min-w-60 max-w-72 rounded-md border px-3 py-3 text-left shadow-lg transition-shadow',
                theme.node,
                selected && theme.selected,
            )}
        >
            {data.kind === 'trigger' ? null : (
                <Handle
                    type="target"
                    position={Position.Left}
                    className={cx('!size-3 !border-2', theme.handle)}
                />
            )}
            <Handle
                type="source"
                position={Position.Right}
                className={cx('!size-3 !border-2', theme.handle)}
            />
            <span
                className={cx(
                    'absolute inset-y-3 left-0 w-1 rounded-r-full',
                    theme.accent,
                )}
            />
            <div className="flex min-w-0 items-start gap-3 pl-1">
                <ModuleIconBadge kind={data.kind} moduleKey={data.moduleKey} />
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-semibold leading-5">
                            {data.label}
                        </p>
                        <span
                            className={cx(
                                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                                theme.badge,
                            )}
                        >
                            {kindLabel(data.kind)}
                        </span>
                    </div>
                    <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-muted-foreground">
                        {data.description}
                    </p>
                </div>
            </div>
        </div>
    );
}

const nodeTypes = {
    automation: AutomationFlowNode,
};

function graphToNodes(
    graph: AutomationGraph,
    modulesByKey: Map<string, AutomationModuleMetadata>,
): FlowNode[] {
    return graph.nodes.map((node) => {
        const module = modulesByKey.get(node.moduleKey);
        return {
            id: node.id,
            type: 'automation',
            position: node.position,
            data: {
                moduleKey: node.moduleKey,
                kind: node.kind,
                config: node.config,
                label: module ? automationModuleTitle(module) : node.moduleKey,
                description: module
                    ? automationModuleDescription(module)
                    : node.moduleKey,
            },
        };
    });
}

const automationEdgeOptions = {
    markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'hsl(var(--muted-foreground))',
        height: 18,
        width: 18,
    },
    style: {
        stroke: 'hsl(var(--muted-foreground))',
        strokeWidth: 2,
    },
    type: 'smoothstep',
};

function graphToEdges(graph: AutomationGraph): Edge[] {
    return graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        ...automationEdgeOptions,
    }));
}

function flowToGraph(nodes: FlowNode[], edges: Edge[]): AutomationGraph {
    return {
        nodes: nodes.map((node) => ({
            id: node.id,
            moduleKey: node.data.moduleKey,
            kind: node.data.kind,
            position: node.position,
            config: node.data.config,
        })),
        edges: edges
            .filter((edge) => edge.source && edge.target)
            .map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
            })),
    };
}

function updateNodeSelection(nodes: FlowNode[], selectedNodeId: string | null) {
    return nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
    }));
}

function defaultConfig(module: AutomationModuleMetadata): AutomationJsonObject {
    return Object.fromEntries(
        module.configFields
            .filter(
                (field) =>
                    field.type === 'select' &&
                    field.required &&
                    field.options?.[0],
            )
            .map((field) => [field.key, field.options?.[0]?.value]),
    );
}

function jsonFieldValue(value: unknown) {
    if (value === undefined) {
        return '';
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return '';
    }
}

function parseJsonField(value: string): unknown {
    if (!value.trim()) {
        return undefined;
    }

    return JSON.parse(value);
}

function panelTitle(panel: AutomationEditorPanel | null) {
    switch (panel) {
        case 'details':
            return 'Detalji tijeka rada';
        case 'modules':
            return 'Moduli';
        case 'settings':
            return 'Postavke modula';
        case 'testing':
            return 'Pokreni';
        default:
            return '';
    }
}

function panelDescription(panel: AutomationEditorPanel | null) {
    switch (panel) {
        case 'details':
            return 'Naziv i ključ automatizacije.';
        case 'modules':
            return 'Dodajte okidače, uvjete i akcije u dijagram.';
        case 'settings':
            return 'Konfiguracija trenutno odabranog modula.';
        case 'testing':
            return 'Pokrenite tijek rada iz sintetičkog ili postojećeg ulaza.';
        default:
            return undefined;
    }
}

function automationDraftSnapshot({
    description,
    graph,
    key,
    maxConcurrentRunsInput,
    name,
    status,
}: {
    description: string;
    graph: AutomationGraph;
    key: string;
    maxConcurrentRunsInput: string;
    name: string;
    status: AutomationDefinitionStatus;
}) {
    return JSON.stringify({
        description,
        graph,
        key,
        maxConcurrentRunsInput,
        name,
        status,
    });
}

function autosaveLabel(status: AutosaveStatus) {
    switch (status) {
        case 'failed':
            return 'Spremanje nije uspjelo.';
        case 'saving':
            return 'Spremanje...';
        case 'unsaved':
            return 'Nespremljene promjene';
        case 'saved':
            return 'Spremljeno';
    }
}

function SaveResultNotice({ result }: { result: AutomationSaveResult }) {
    if (result.ok) {
        return null;
    }

    return (
        <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
            <Stack spacing={1}>
                {result.errors.map((error) => (
                    <Typography key={error} level="body2">
                        {error}
                    </Typography>
                ))}
            </Stack>
        </div>
    );
}

export function AutomationFlowEditor({
    automationId,
    initialDescription,
    initialGraph,
    initialKey,
    initialMaxConcurrentRuns,
    initialName,
    initialStatus,
    maxConcurrentRunsLimit,
    modules,
    testPanel,
}: AutomationFlowEditorProps) {
    const router = useRouter();
    const [currentAutomationId, setCurrentAutomationId] =
        useState(automationId);
    const [definitionKey, setDefinitionKey] = useState(initialKey);
    const modulesByKey = useMemo(
        () => new Map(modules.map((module) => [module.key, module])),
        [modules],
    );
    const [name, setName] = useState(initialName);
    const [description, setDescription] = useState(initialDescription ?? '');
    const [status, setStatus] =
        useState<AutomationDefinitionStatus>(initialStatus);
    const [maxConcurrentRunsInput, setMaxConcurrentRunsInput] = useState(
        initialMaxConcurrentRuns.toString(),
    );
    const [activePanel, setActivePanel] =
        useState<AutomationEditorPanel | null>(automationId ? null : 'details');
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
        initialGraph.nodes[0]?.id ?? null,
    );
    const [nodes, setNodes, onNodesChangeBase] = useNodesState<FlowNode>(
        updateNodeSelection(
            graphToNodes(initialGraph, modulesByKey),
            selectedNodeId,
        ),
    );
    const [edges, setEdges, onEdgesChange] = useEdgesState(
        graphToEdges(initialGraph),
    );
    const [result, setResult] = useState<AutomationSaveResult | null>(null);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [autosaveStatus, setAutosaveStatus] =
        useState<AutosaveStatus>('saved');
    const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(
        null,
    );
    const [isPending, startTransition] = useTransition();
    const selectedNode = nodes.find((node) => node.id === selectedNodeId);
    const selectedModule = selectedNode
        ? modulesByKey.get(selectedNode.data.moduleKey)
        : null;
    const automationKey = useMemo(
        () =>
            currentAutomationId
                ? definitionKey || initialKey || 'automatizacija'
                : slugify(name) ||
                  definitionKey ||
                  initialKey ||
                  'nova-automatizacija',
        [currentAutomationId, definitionKey, initialKey, name],
    );
    const draftGraph = useMemo(() => flowToGraph(nodes, edges), [nodes, edges]);
    const saveSnapshot = useMemo(
        () =>
            automationDraftSnapshot({
                description,
                graph: draftGraph,
                key: automationKey,
                maxConcurrentRunsInput,
                name,
                status,
            }),
        [
            automationKey,
            description,
            draftGraph,
            maxConcurrentRunsInput,
            name,
            status,
        ],
    );
    const latestSaveSnapshot = useRef(saveSnapshot);
    const groupedModules = useMemo(
        () =>
            modules.reduce<
                Record<AutomationModuleKind, AutomationModuleMetadata[]>
            >(
                (groups, module) => {
                    groups[module.kind].push(module);
                    return groups;
                },
                {
                    trigger: [],
                    filter: [],
                    condition: [],
                    action: [],
                },
            ),
        [modules],
    );

    useEffect(() => {
        latestSaveSnapshot.current = saveSnapshot;
    }, [saveSnapshot]);

    useEffect(() => {
        if (lastSavedSnapshot === null) {
            setLastSavedSnapshot(saveSnapshot);
        }
    }, [lastSavedSnapshot, saveSnapshot]);

    function selectNode(nodeId: string | null) {
        setSelectedNodeId(nodeId);
        setNodes((current) => updateNodeSelection(current, nodeId));
    }

    function onNodesChange(changes: NodeChange<FlowNode>[]) {
        onNodesChangeBase(changes);
    }

    const onConnect: OnConnect = (connection) => {
        setEdges((currentEdges) =>
            addEdge(
                {
                    ...connection,
                    id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
                    ...automationEdgeOptions,
                },
                currentEdges,
            ),
        );
        setResult(null);
    };

    function openPanel(panel: AutomationEditorPanel) {
        setActivePanel((currentPanel) =>
            currentPanel === panel ? null : panel,
        );
    }

    function addModule(module: AutomationModuleMetadata) {
        const moduleCount = nodes.filter(
            (node) => node.data.moduleKey === module.key,
        ).length;
        const id = `${module.kind}-${module.key.replaceAll('.', '-')}-${Date.now()}`;
        const nextNode: FlowNode = {
            id,
            selected: true,
            type: 'automation',
            position: {
                x: 80 + moduleCount * 24,
                y: 80 + nodes.length * 70,
            },
            data: {
                moduleKey: module.key,
                kind: module.kind,
                config: defaultConfig(module),
                label: automationModuleTitle(module),
                description: automationModuleDescription(module),
            },
        };

        setNodes((current) =>
            updateNodeSelection([...current, nextNode], nextNode.id),
        );
        setSelectedNodeId(nextNode.id);
        setActivePanel('settings');
        setResult(null);
    }

    function updateSelectedConfig(key: string, value: unknown) {
        if (!selectedNodeId) {
            return;
        }

        setNodes((current) =>
            current.map((node) =>
                node.id === selectedNodeId
                    ? {
                          ...node,
                          data: {
                              ...node.data,
                              config: {
                                  ...node.data.config,
                                  [key]: value,
                              },
                          },
                      }
                    : node,
            ),
        );
        setResult(null);
    }

    const saveDraft = useCallback(
        async ({
            requireLatest = false,
            snapshot,
            statusOverride,
        }: {
            requireLatest?: boolean;
            snapshot?: string;
            statusOverride?: AutomationDefinitionStatus;
        } = {}) => {
            const draftStatus = statusOverride ?? status;
            const draftSnapshot =
                snapshot ??
                automationDraftSnapshot({
                    description,
                    graph: draftGraph,
                    key: automationKey,
                    maxConcurrentRunsInput,
                    name,
                    status: draftStatus,
                });

            setJsonError(null);
            setAutosaveStatus('saving');

            const saveResult = await saveAutomationDefinitionAction({
                id: currentAutomationId,
                key: automationKey,
                name,
                description,
                status: draftStatus,
                maxConcurrentRuns: Number(maxConcurrentRunsInput),
                graph: draftGraph,
            });

            if (requireLatest && latestSaveSnapshot.current !== draftSnapshot) {
                return saveResult;
            }

            if (saveResult.ok) {
                setResult(null);
                setAutosaveStatus('saved');
                setLastSavedSnapshot(draftSnapshot);
                setCurrentAutomationId(saveResult.automationId);
                setDefinitionKey(automationKey);
            } else {
                setResult(saveResult);
                setAutosaveStatus('failed');
            }

            return saveResult;
        },
        [
            automationKey,
            currentAutomationId,
            description,
            draftGraph,
            maxConcurrentRunsInput,
            name,
            status,
        ],
    );

    useEffect(() => {
        if (!currentAutomationId || lastSavedSnapshot === null || jsonError) {
            return;
        }

        if (saveSnapshot === lastSavedSnapshot) {
            setAutosaveStatus('saved');
            return;
        }

        setAutosaveStatus('unsaved');

        const timeout = window.setTimeout(() => {
            void saveDraft({
                requireLatest: true,
                snapshot: saveSnapshot,
            });
        }, 700);

        return () => window.clearTimeout(timeout);
    }, [
        currentAutomationId,
        jsonError,
        lastSavedSnapshot,
        saveDraft,
        saveSnapshot,
    ]);

    function save() {
        startTransition(async () => {
            const saveResult = await saveDraft({
                snapshot: saveSnapshot,
            });

            if (saveResult.ok) {
                router.replace(KnownPages.Automation(saveResult.automationId));
                router.refresh();
            }
        });
    }

    function changeDefinitionStatus(nextStatus: AutomationDefinitionStatus) {
        if (!currentAutomationId) {
            return;
        }

        const previousStatus = status;
        const hadUnsavedChanges =
            lastSavedSnapshot !== null && saveSnapshot !== lastSavedSnapshot;
        const nextSnapshot = automationDraftSnapshot({
            description,
            graph: draftGraph,
            key: automationKey,
            maxConcurrentRunsInput,
            name,
            status: nextStatus,
        });

        setStatus(nextStatus);
        setResult(null);
        setAutosaveStatus('saving');

        startTransition(async () => {
            const statusResult = await updateAutomationStatusAction(
                currentAutomationId,
                nextStatus,
            );

            if (!statusResult.ok) {
                setStatus(previousStatus);
                setResult(statusResult);
                setAutosaveStatus('failed');
                return;
            }

            setResult(null);
            if (hadUnsavedChanges) {
                setAutosaveStatus('unsaved');
            } else {
                setLastSavedSnapshot(nextSnapshot);
                setAutosaveStatus('saved');
            }
            router.refresh();
        });
    }

    const statusMeta = automationStatusMeta(status);
    const canAutosave = Boolean(currentAutomationId);

    const header = currentAutomationId ? (
        <AdminPageHeader
            breadcrumbs={
                <Row spacing={2} className="min-w-0 items-center">
                    <div className="min-w-0">
                        <Breadcrumbs
                            items={[
                                {
                                    label: <AdminBreadcrumbLevelSelector />,
                                    href: KnownPages.Automations,
                                },
                                { label: name },
                            ]}
                        />
                    </div>
                    <Chip
                        className="shrink-0"
                        color={statusMeta.color}
                        size="sm"
                        variant="soft"
                    >
                        {statusMeta.label}
                    </Chip>
                </Row>
            }
            actions={
                <Row spacing={2} className="items-center">
                    <Button
                        type="button"
                        size="sm"
                        variant={
                            activePanel === 'details' ? 'soft' : 'outlined'
                        }
                        aria-pressed={activePanel === 'details'}
                        onClick={() => openPanel('details')}
                        startDecorator={<Settings className="size-4" />}
                    >
                        Detalji
                    </Button>
                    <AutomationActionsMenu
                        disabled={isPending}
                        onStatusChange={changeDefinitionStatus}
                        status={status}
                    />
                </Row>
            }
            heading={name}
        />
    ) : null;

    const detailPanel = (
        <Stack spacing={4}>
            <Input
                label="Naziv"
                value={name}
                onChange={(event) => {
                    setName(event.target.value);
                    setResult(null);
                }}
                fullWidth
            />
            <Input
                label="Ključ"
                value={automationKey}
                readOnly
                helperText={
                    automationId
                        ? 'Postojeći ključ ostaje nepromijenjen.'
                        : 'Automatski se generira iz naziva.'
                }
                fullWidth
            />
            <Input
                label="Paralelna izvođenja"
                helperText={`Najviše ${maxConcurrentRunsLimit} runova ove automatizacije istovremeno.`}
                type="number"
                min={1}
                max={maxConcurrentRunsLimit}
                step={1}
                value={maxConcurrentRunsInput}
                onChange={(event) => {
                    setMaxConcurrentRunsInput(event.target.value);
                    setResult(null);
                }}
                fullWidth
            />
            <Stack spacing={1}>
                <label
                    className="text-sm font-medium"
                    htmlFor="automation-description"
                >
                    Opis
                </label>
                <textarea
                    id="automation-description"
                    value={description}
                    onChange={(event) => {
                        setDescription(event.target.value);
                        setResult(null);
                    }}
                    className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
            </Stack>
            {!currentAutomationId ? (
                <Button
                    type="button"
                    disabled={isPending}
                    loading={isPending}
                    onClick={save}
                    startDecorator={<Add className="size-4" />}
                >
                    Kreiraj
                </Button>
            ) : null}
        </Stack>
    );

    const modulesPanel = (
        <Stack spacing={4}>
            {(
                [
                    'trigger',
                    'filter',
                    'condition',
                    'action',
                ] satisfies AutomationModuleKind[]
            ).map((kind) => (
                <Stack key={kind} spacing={2}>
                    <Typography level="body2" semiBold>
                        {kindLabel(kind)}
                    </Typography>
                    {groupedModules[kind].length === 0 ? (
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Nema dostupnih modula.
                        </Typography>
                    ) : (
                        groupedModules[kind].map((module) => (
                            <button
                                key={module.key}
                                type="button"
                                onClick={() => addModule(module)}
                                className={cx(
                                    'w-full rounded-md border bg-background p-3 text-left transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                    automationNodeKindTheme[module.kind].node,
                                )}
                            >
                                <Row spacing={2} className="items-start">
                                    <ModuleIconBadge
                                        kind={module.kind}
                                        moduleKey={module.key}
                                    />
                                    <Stack spacing={1}>
                                        <Typography level="body2" semiBold>
                                            {automationModuleTitle(module)}
                                        </Typography>
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            {automationModuleDescription(
                                                module,
                                            )}
                                        </Typography>
                                        <Typography
                                            level="body3"
                                            className="break-all text-muted-foreground"
                                        >
                                            {module.key}
                                        </Typography>
                                    </Stack>
                                </Row>
                            </button>
                        ))
                    )}
                </Stack>
            ))}
        </Stack>
    );

    const settingsPanel =
        !selectedNode || !selectedModule ? (
            <Typography level="body2" className="text-muted-foreground">
                Odaberite modul u grafu.
            </Typography>
        ) : (
            <Stack spacing={3}>
                <Stack spacing={1}>
                    <Typography level="body2" semiBold>
                        {automationModuleTitle(selectedModule)}
                    </Typography>
                    <Typography level="body3" className="text-muted-foreground">
                        {automationModuleDescription(selectedModule)}
                    </Typography>
                    <Row spacing={1} className="flex-wrap">
                        <Chip size="sm" variant="soft">
                            {kindLabel(selectedModule.kind)}
                        </Chip>
                        {selectedModule.mutatesData ? (
                            <Chip size="sm" color="warning" variant="soft">
                                Mijenja podatke
                            </Chip>
                        ) : null}
                        {selectedModule.dryRunSupported ? (
                            <Chip size="sm" color="info" variant="soft">
                                Probno izvođenje
                            </Chip>
                        ) : null}
                    </Row>
                </Stack>

                {selectedModule.configFields.length === 0 ? (
                    <Typography level="body3" className="text-muted-foreground">
                        Modul nema konfiguracijskih polja.
                    </Typography>
                ) : null}

                {selectedModule.configFields.map((field) => {
                    const value = selectedNode.data.config[field.key];

                    if (field.type === 'select') {
                        return (
                            <SelectItems
                                key={field.key}
                                className="w-full"
                                label={automationConfigFieldLabel(
                                    selectedModule,
                                    field,
                                )}
                                value={typeof value === 'string' ? value : ''}
                                items={
                                    field.options?.map((option) => ({
                                        value: option.value,
                                        label: automationConfigFieldOptionLabel(
                                            {
                                                field,
                                                module: selectedModule,
                                                option,
                                            },
                                        ),
                                    })) ?? []
                                }
                                helperText={automationConfigFieldDescription(
                                    selectedModule,
                                    field,
                                )}
                                onValueChange={(nextValue) =>
                                    updateSelectedConfig(field.key, nextValue)
                                }
                            />
                        );
                    }

                    if (field.type === 'boolean') {
                        return (
                            <Checkbox
                                key={field.key}
                                label={automationConfigFieldLabel(
                                    selectedModule,
                                    field,
                                )}
                                checked={value === true}
                                onCheckedChange={(checked) =>
                                    updateSelectedConfig(
                                        field.key,
                                        checked === true,
                                    )
                                }
                            />
                        );
                    }

                    if (field.type === 'json') {
                        return (
                            <Stack key={field.key} spacing={1}>
                                <label
                                    className="text-sm font-medium"
                                    htmlFor={`automation-config-${field.key}`}
                                >
                                    {automationConfigFieldLabel(
                                        selectedModule,
                                        field,
                                    )}
                                </label>
                                <textarea
                                    id={`automation-config-${field.key}`}
                                    value={jsonFieldValue(value)}
                                    onChange={(event) => {
                                        try {
                                            updateSelectedConfig(
                                                field.key,
                                                parseJsonField(
                                                    event.target.value,
                                                ),
                                            );
                                            setJsonError(null);
                                        } catch (error) {
                                            setJsonError(
                                                error instanceof Error
                                                    ? error.message
                                                    : 'JSON nije valjan.',
                                            );
                                        }
                                    }}
                                    className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-hidden ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                />
                                {automationConfigFieldDescription(
                                    selectedModule,
                                    field,
                                ) ? (
                                    <Typography
                                        level="body3"
                                        className="text-muted-foreground"
                                    >
                                        {automationConfigFieldDescription(
                                            selectedModule,
                                            field,
                                        )}
                                    </Typography>
                                ) : null}
                            </Stack>
                        );
                    }

                    return (
                        <Input
                            key={field.key}
                            label={automationConfigFieldLabel(
                                selectedModule,
                                field,
                            )}
                            helperText={automationConfigFieldDescription(
                                selectedModule,
                                field,
                            )}
                            placeholder={automationConfigFieldPlaceholder(
                                selectedModule,
                                field,
                            )}
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={
                                typeof value === 'string' ||
                                typeof value === 'number'
                                    ? value
                                    : ''
                            }
                            onChange={(event) =>
                                updateSelectedConfig(
                                    field.key,
                                    field.type === 'number'
                                        ? event.target.value.trim()
                                            ? Number(event.target.value)
                                            : undefined
                                        : event.target.value,
                                )
                            }
                            fullWidth
                        />
                    );
                })}

                {automationModuleInputDescription(selectedModule) ? (
                    <Typography level="body3" className="text-muted-foreground">
                        Ulaz: {automationModuleInputDescription(selectedModule)}
                    </Typography>
                ) : null}
                {automationModuleOutputDescription(selectedModule) ? (
                    <Typography level="body3" className="text-muted-foreground">
                        Izlaz:{' '}
                        {automationModuleOutputDescription(selectedModule)}
                    </Typography>
                ) : null}
                {jsonError ? (
                    <Typography
                        level="body3"
                        className="text-red-700 dark:text-red-300"
                    >
                        {jsonError}
                    </Typography>
                ) : null}
            </Stack>
        );

    return (
        <>
            {header}
            <Stack spacing={3}>
                {result ? <SaveResultNotice result={result} /> : null}

                <div className="min-w-0 overflow-hidden rounded-md border bg-background shadow-xs dark:bg-neutral-950">
                    <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center">
                        <div className="min-w-0 flex-1">
                            {canAutosave ? (
                                <Typography
                                    level="body3"
                                    className={
                                        autosaveStatus === 'failed'
                                            ? 'text-red-700 dark:text-red-300'
                                            : 'text-muted-foreground'
                                    }
                                >
                                    {autosaveLabel(autosaveStatus)}
                                </Typography>
                            ) : null}
                        </div>
                        <Row
                            spacing={2}
                            className="ml-auto flex-wrap justify-end"
                        >
                            {!currentAutomationId ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={
                                        activePanel === 'details'
                                            ? 'soft'
                                            : 'outlined'
                                    }
                                    aria-pressed={activePanel === 'details'}
                                    onClick={() => openPanel('details')}
                                    startDecorator={
                                        <Settings className="size-4" />
                                    }
                                >
                                    Detalji
                                </Button>
                            ) : null}
                            <Button
                                type="button"
                                size="sm"
                                variant={
                                    activePanel === 'settings'
                                        ? 'soft'
                                        : 'outlined'
                                }
                                aria-pressed={activePanel === 'settings'}
                                onClick={() => openPanel('settings')}
                                startDecorator={
                                    <Configuration className="size-4" />
                                }
                            >
                                Postavke
                            </Button>
                            {testPanel ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={
                                        activePanel === 'testing'
                                            ? 'soft'
                                            : 'outlined'
                                    }
                                    aria-pressed={activePanel === 'testing'}
                                    onClick={() => openPanel('testing')}
                                    startDecorator={<Play className="size-4" />}
                                >
                                    Pokreni
                                </Button>
                            ) : null}
                            <IconButton
                                type="button"
                                size="sm"
                                variant="plain"
                                title="Dodaj modul"
                                aria-pressed={activePanel === 'modules'}
                                onClick={() => openPanel('modules')}
                            >
                                <Add className="size-4" />
                            </IconButton>
                        </Row>
                    </div>
                    <div className="h-[calc(100vh-260px)] min-h-[560px]">
                        <ReactFlowProvider>
                            <ReactFlow
                                className="bg-slate-50 text-foreground dark:bg-neutral-950 [&_.react-flow__attribution]:bg-card/80 [&_.react-flow__attribution]:text-muted-foreground [&_.react-flow__controls]:overflow-hidden [&_.react-flow__controls]:rounded-md [&_.react-flow__controls]:border [&_.react-flow__controls]:border-border [&_.react-flow__controls]:bg-card [&_.react-flow__controls]:shadow-lg [&_.react-flow__controls-button]:border-border [&_.react-flow__controls-button]:bg-card [&_.react-flow__controls-button]:text-foreground [&_.react-flow__controls-button:hover]:bg-muted [&_.react-flow__controls-button_svg]:fill-foreground [&_.react-flow__edge-path]:stroke-muted-foreground [&_.react-flow__pane]:cursor-grab [&_.react-flow__pane.dragging]:cursor-grabbing"
                                defaultEdgeOptions={automationEdgeOptions}
                                nodes={nodes}
                                edges={edges}
                                nodeTypes={nodeTypes}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                onConnect={onConnect}
                                onNodeClick={(_event, node) => {
                                    selectNode(node.id);
                                    setActivePanel('settings');
                                }}
                                onPaneClick={() => selectNode(null)}
                                fitView
                            >
                                <Background
                                    color="hsl(var(--border))"
                                    gap={24}
                                    size={1.5}
                                />
                                <Controls showInteractive={false} />
                            </ReactFlow>
                        </ReactFlowProvider>
                    </div>
                </div>
            </Stack>

            <AutomationSlidePanel
                open={Boolean(activePanel)}
                title={panelTitle(activePanel)}
                description={panelDescription(activePanel)}
                onOpenChange={(open) => {
                    if (!open) {
                        setActivePanel(null);
                    }
                }}
            >
                {activePanel === 'details' ? detailPanel : null}
                {activePanel === 'modules' ? modulesPanel : null}
                {activePanel === 'settings' ? settingsPanel : null}
                {activePanel === 'testing' ? testPanel : null}
            </AutomationSlidePanel>
        </>
    );
}
