import type { GardenStructureBuildCategory } from '../useGameState';
import type {
    GardenStructureBatchDescription,
    GardenStructureSemanticPlan,
} from './structurePlanTypes';

function instanceIdsForGeometry(
    batches: readonly GardenStructureBatchDescription[],
    geometryKind: GardenStructureBatchDescription['geometryKind'],
) {
    return batches
        .filter((batch) => batch.geometryKind === geometryKind)
        .flatMap((batch) => batch.instanceIds);
}

export function getGardenStructureSelectablePartIds(
    plan: GardenStructureSemanticPlan,
    category: GardenStructureBuildCategory,
) {
    let ids: readonly string[];
    switch (category) {
        case 'footprint':
            ids = [...plan.footprint.ids, ...plan.floors.ids];
            break;
        case 'structure':
            ids = instanceIdsForGeometry(
                [...plan.batches.opaque, ...plan.batches.transparent],
                'edge-segment',
            );
            break;
        case 'roof':
            ids = plan.batches.roof.flatMap((batch) => batch.instanceIds);
            break;
        case 'interior':
            ids = plan.batches.props.flatMap((batch) => batch.instanceIds);
            break;
    }

    return [...new Set(ids)].sort((left, right) =>
        left < right ? -1 : left > right ? 1 : 0,
    );
}
