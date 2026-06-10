import type {
    AutomationGraph,
    AutomationGraphNode,
    AutomationJsonObject,
    AutomationModuleKind,
    SelectAutomationRun,
} from '../schema';

export type AutomationConfigFieldOption = {
    value: string;
    label: string;
};

export type AutomationConfigField = {
    key: string;
    label: string;
    description?: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'json';
    required?: boolean;
    options?: AutomationConfigFieldOption[];
    placeholder?: string;
};

export type AutomationModuleMetadata = {
    key: string;
    kind: AutomationModuleKind;
    title: string;
    description: string;
    category: string;
    configFields: AutomationConfigField[];
    inputDescription?: string;
    outputDescription?: string;
    dryRunSupported: boolean;
    mutatesData: boolean;
    retryable: boolean;
};

export type AutomationSourceEvent = {
    id?: number;
    type: string;
    version?: number;
    aggregateId: string;
    data: AutomationJsonObject;
    createdAt?: Date;
};

export type AutomationExecutionContext = {
    run: SelectAutomationRun;
    graph: AutomationGraph;
    dryRun: boolean;
    event?: AutomationSourceEvent;
    values: Map<string, AutomationJsonObject>;
};

export type AutomationModuleResult = {
    status: 'succeeded' | 'skipped';
    output?: AutomationJsonObject;
    reason?: string;
};

export type AutomationModule = AutomationModuleMetadata & {
    validateConfig?: (config: AutomationJsonObject) => string[];
    execute: (
        context: AutomationExecutionContext,
        node: AutomationGraphNode,
    ) => Promise<AutomationModuleResult>;
};

export type AutomationGraphValidationResult =
    | {
          ok: true;
          orderedNodes: AutomationGraphNode[];
      }
    | {
          ok: false;
          errors: string[];
      };

export class AutomationModuleExecutionError extends Error {
    constructor(
        message: string,
        readonly code: string,
        readonly retryable = false,
    ) {
        super(message);
        this.name = 'AutomationModuleExecutionError';
    }
}
