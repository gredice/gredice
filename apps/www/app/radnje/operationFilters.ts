import type { OperationData } from '@gredice/client';
import { PLANT_STAGES, type PlantStageName } from '@gredice/game';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText';

const plantStageNames = new Set<string>(
    PLANT_STAGES.map((stage) => stage.name),
);
const stageOrder = new Map<string, number>(
    PLANT_STAGES.map((stage, index): [string, number] => [stage.name, index]),
);

function isPlantStageName(name: string | undefined): name is PlantStageName {
    return typeof name === 'string' && plantStageNames.has(name);
}

export function operationMatchesSearch(
    operation: Pick<OperationData, 'information'>,
    search: string,
) {
    const normalizedSearch = normalizeSearchText(search);

    return (
        !normalizedSearch ||
        normalizeSearchText(operation.information.label).includes(
            normalizedSearch,
        )
    );
}

export function compareOperationsByStageAndLabel(
    a: Pick<OperationData, 'attributes' | 'information'>,
    b: Pick<OperationData, 'attributes' | 'information'>,
) {
    const stageDiff =
        (stageOrder.get(a.attributes.stage?.information?.name ?? '') ??
            Number.MAX_SAFE_INTEGER) -
        (stageOrder.get(b.attributes.stage?.information?.name ?? '') ??
            Number.MAX_SAFE_INTEGER);

    return stageDiff !== 0
        ? stageDiff
        : a.information.label.localeCompare(b.information.label);
}

export function getAvailableOperationStages(
    operations: Pick<OperationData, 'attributes'>[],
) {
    const stageNamesInOperations = new Set(
        operations
            .map((operation) => operation.attributes.stage?.information?.name)
            .filter(isPlantStageName),
    );

    return PLANT_STAGES.filter((stage) =>
        stageNamesInOperations.has(stage.name),
    );
}
