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
import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Chip } from '@gredice/ui/Chip';
import { Input } from '@gredice/ui/Input';
import {
    Add,
    Configuration,
    Delete,
    Layers,
    Play,
    Save,
    Settings,
} from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    addEdge,
    Background,
    Controls,
    type Edge,
    type Node,
    type NodeChange,
    type OnConnect,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useMemo, useState, useTransition } from 'react';
import { KnownPages } from '../../../src/KnownPages';
import { AutomationSlidePanel } from './AutomationSlidePanel';
import {
    type AutomationSaveResult,
    saveAutomationDefinitionAction,
} from './actions';
import { automationStatusMeta } from './presentation';

type FlowNodeData = Record<string, unknown> & {
    moduleKey: string;
    kind: AutomationModuleKind;
    config: AutomationJsonObject;
    label: string;
};

type FlowNode = Node<FlowNodeData>;
type AutomationEditorPanel = 'details' | 'modules' | 'settings' | 'testing';

type AutomationFlowEditorProps = {
    automationId?: number;
    initialKey: string;
    initialName: string;
    initialDescription: string | null;
    initialStatus: AutomationDefinitionStatus;
    initialGraph: AutomationGraph;
    modules: AutomationModuleMetadata[];
    testPanel?: ReactNode;
};

const definitionStatusItems = [
    { value: 'draft', label: 'Skica' },
    { value: 'enabled', label: 'Uključena' },
    { value: 'disabled', label: 'Isključena' },
    { value: 'archived', label: 'Arhivirana' },
] satisfies Array<{ value: AutomationDefinitionStatus; label: string }>;

function kindLabel(kind: AutomationModuleKind) {
    switch (kind) {
        case 'trigger':
            return 'Trigger';
        case 'filter':
            return 'Filter';
        case 'condition':
            return 'Uvjet';
        case 'action':
            return 'Akcija';
    }
}

function kindClassName(kind: AutomationModuleKind) {
    switch (kind) {
        case 'trigger':
            return 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100';
        case 'filter':
            return 'border-slate-300 bg-slate-50 text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
        case 'condition':
            return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100';
        case 'action':
            return 'border-green-300 bg-green-50 text-green-950 dark:border-green-800 dark:bg-green-950 dark:text-green-100';
    }
}

function nodeClassName(kind: AutomationModuleKind, selected: boolean) {
    return [
        'rounded-md border px-3 py-2 text-left shadow-xs',
        kindClassName(kind),
        selected ? 'ring-2 ring-primary ring-offset-2' : '',
    ]
        .filter(Boolean)
        .join(' ');
}

function graphToNodes(
    graph: AutomationGraph,
    modulesByKey: Map<string, AutomationModuleMetadata>,
): FlowNode[] {
    return graph.nodes.map((node) => {
        const module = modulesByKey.get(node.moduleKey);
        return {
            id: node.id,
            type: 'default',
            position: node.position,
            data: {
                moduleKey: node.moduleKey,
                kind: node.kind,
                config: node.config,
                label: module?.title ?? node.moduleKey,
            },
            className: nodeClassName(node.kind, false),
        };
    });
}

function graphToEdges(graph: AutomationGraph): Edge[] {
    return graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated: false,
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

function updateNodeClassNames(
    nodes: FlowNode[],
    selectedNodeId: string | null,
) {
    return nodes.map((node) => ({
        ...node,
        className: nodeClassName(node.data.kind, node.id === selectedNodeId),
    }));
}

function defaultConfig(module: AutomationModuleMetadata): AutomationJsonObject {
    return Object.fromEntries(
        module.configFields
            .filter((field) => field.type === 'select' && field.options?.[0])
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
            return 'Detalji workflowa';
        case 'modules':
            return 'Moduli';
        case 'settings':
            return 'Postavke modula';
        case 'testing':
            return 'Testiranje';
        default:
            return '';
    }
}

function panelDescription(panel: AutomationEditorPanel | null) {
    switch (panel) {
        case 'details':
            return 'Naziv, ključ, status i opis automatizacije.';
        case 'modules':
            return 'Dodajte triggere, uvjete i akcije u dijagram.';
        case 'settings':
            return 'Konfiguracija trenutno odabranog modula.';
        case 'testing':
            return 'Pokrenite probno izvođenje iz sintetičkog ili postojećeg ulaza.';
        default:
            return undefined;
    }
}

function SaveResultNotice({ result }: { result: AutomationSaveResult }) {
    if (result.ok) {
        return (
            <div
                role="status"
                className="rounded-md border border-green-200 bg-green-50 p-3 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
            >
                <Typography level="body2">
                    Automatizacija je spremljena.
                </Typography>
            </div>
        );
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
    initialName,
    initialStatus,
    modules,
    testPanel,
}: AutomationFlowEditorProps) {
    const router = useRouter();
    const modulesByKey = useMemo(
        () => new Map(modules.map((module) => [module.key, module])),
        [modules],
    );
    const [name, setName] = useState(initialName);
    const [description, setDescription] = useState(initialDescription ?? '');
    const [status, setStatus] =
        useState<AutomationDefinitionStatus>(initialStatus);
    const [activePanel, setActivePanel] =
        useState<AutomationEditorPanel | null>(automationId ? null : 'details');
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
        initialGraph.nodes[0]?.id ?? null,
    );
    const [nodes, setNodes, onNodesChangeBase] = useNodesState<FlowNode>(
        updateNodeClassNames(
            graphToNodes(initialGraph, modulesByKey),
            selectedNodeId,
        ),
    );
    const [edges, setEdges, onEdgesChange] = useEdgesState(
        graphToEdges(initialGraph),
    );
    const [result, setResult] = useState<AutomationSaveResult | null>(null);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const selectedNode = nodes.find((node) => node.id === selectedNodeId);
    const selectedModule = selectedNode
        ? modulesByKey.get(selectedNode.data.moduleKey)
        : null;
    const automationKey = useMemo(
        () =>
            automationId
                ? initialKey
                : slugify(name) || initialKey || 'nova-automatizacija',
        [automationId, initialKey, name],
    );
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

    function selectNode(nodeId: string | null) {
        setSelectedNodeId(nodeId);
        setNodes((current) => updateNodeClassNames(current, nodeId));
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
                },
                currentEdges,
            ),
        );
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
            type: 'default',
            position: {
                x: 80 + moduleCount * 24,
                y: 80 + nodes.length * 70,
            },
            data: {
                moduleKey: module.key,
                kind: module.kind,
                config: defaultConfig(module),
                label: module.title,
            },
            className: nodeClassName(module.kind, true),
        };

        setNodes((current) =>
            updateNodeClassNames([...current, nextNode], nextNode.id),
        );
        setSelectedNodeId(nextNode.id);
        setActivePanel('settings');
        setResult(null);
    }

    function removeSelectedNode() {
        if (!selectedNodeId) {
            return;
        }

        setNodes((current) =>
            current.filter((node) => node.id !== selectedNodeId),
        );
        setEdges((current) =>
            current.filter(
                (edge) =>
                    edge.source !== selectedNodeId &&
                    edge.target !== selectedNodeId,
            ),
        );
        setSelectedNodeId(null);
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

    function save() {
        setJsonError(null);
        startTransition(async () => {
            const saveResult = await saveAutomationDefinitionAction({
                id: automationId,
                key: automationKey,
                name,
                description,
                status,
                graph: flowToGraph(nodes, edges),
            });

            setResult(saveResult);
            if (saveResult.ok) {
                router.replace(KnownPages.Automation(saveResult.automationId));
                router.refresh();
            }
        });
    }

    const statusMeta = automationStatusMeta(status);

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
            <SelectItems<AutomationDefinitionStatus>
                className="w-full"
                label="Status"
                value={status}
                items={definitionStatusItems}
                onValueChange={(nextStatus) => {
                    setStatus(nextStatus);
                    setResult(null);
                }}
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
            <Button
                type="button"
                disabled={isPending}
                loading={isPending}
                onClick={save}
                startDecorator={<Save className="size-4" />}
            >
                Spremi
            </Button>
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
                                className="w-full rounded-md border bg-background p-3 text-left transition-colors hover:border-primary/60 hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <Row spacing={2} className="items-start">
                                    <Add className="mt-0.5 size-4 shrink-0" />
                                    <Stack spacing={1}>
                                        <Typography level="body2" semiBold>
                                            {module.title}
                                        </Typography>
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            {module.description}
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
                        {selectedModule.title}
                    </Typography>
                    <Typography level="body3" className="text-muted-foreground">
                        {selectedModule.description}
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
                                Dry-run
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
                                label={field.label}
                                value={typeof value === 'string' ? value : ''}
                                items={
                                    field.options?.map((option) => ({
                                        value: option.value,
                                        label: option.label,
                                    })) ?? []
                                }
                                helperText={field.description}
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
                                label={field.label}
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
                                    {field.label}
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
                                                    : 'Invalid JSON.',
                                            );
                                        }
                                    }}
                                    className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-hidden ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                />
                                {field.description ? (
                                    <Typography
                                        level="body3"
                                        className="text-muted-foreground"
                                    >
                                        {field.description}
                                    </Typography>
                                ) : null}
                            </Stack>
                        );
                    }

                    return (
                        <Input
                            key={field.key}
                            label={field.label}
                            helperText={field.description}
                            placeholder={field.placeholder}
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

                {selectedModule.inputDescription ? (
                    <Typography level="body3" className="text-muted-foreground">
                        Ulaz: {selectedModule.inputDescription}
                    </Typography>
                ) : null}
                {selectedModule.outputDescription ? (
                    <Typography level="body3" className="text-muted-foreground">
                        Izlaz: {selectedModule.outputDescription}
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
            <Stack spacing={3}>
                {result ? <SaveResultNotice result={result} /> : null}

                <div className="min-w-0 overflow-hidden rounded-md border bg-background">
                    <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                        <Row spacing={2} className="min-w-0 flex-wrap">
                            <Chip
                                color={statusMeta.color}
                                size="sm"
                                variant="soft"
                            >
                                {statusMeta.label}
                            </Chip>
                            <Typography level="body2" secondary>
                                {nodes.length} modula, {edges.length} veza
                            </Typography>
                        </Row>
                        <Row spacing={2} className="flex-wrap">
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
                                startDecorator={<Settings className="size-4" />}
                            >
                                Detalji
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={
                                    activePanel === 'modules'
                                        ? 'soft'
                                        : 'outlined'
                                }
                                aria-pressed={activePanel === 'modules'}
                                onClick={() => openPanel('modules')}
                                startDecorator={<Layers className="size-4" />}
                            >
                                Moduli
                            </Button>
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
                                    Testiranje
                                </Button>
                            ) : null}
                            <Button
                                type="button"
                                size="sm"
                                variant="outlined"
                                color="danger"
                                disabled={!selectedNodeId}
                                onClick={removeSelectedNode}
                                startDecorator={<Delete className="size-4" />}
                            >
                                Ukloni
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                disabled={isPending}
                                loading={isPending}
                                onClick={save}
                                startDecorator={<Save className="size-4" />}
                            >
                                Spremi
                            </Button>
                        </Row>
                    </div>
                    <div className="h-[calc(100vh-260px)] min-h-[560px]">
                        <ReactFlowProvider>
                            <ReactFlow
                                nodes={nodes}
                                edges={edges}
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
                                <Background />
                                <Controls />
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
