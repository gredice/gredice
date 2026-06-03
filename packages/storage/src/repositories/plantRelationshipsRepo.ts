import 'server-only';
import {
    buildPlantRelationshipAuthoringSummary,
    type PlantRelationshipAuthoringSummary,
} from '../helpers/plantRelationships';
import { getEntitiesRaw } from './entitiesRepo';

export async function getPlantRelationshipAuthoringSummary(
    entityId: number,
): Promise<PlantRelationshipAuthoringSummary> {
    const plants = await getEntitiesRaw('plant');
    return buildPlantRelationshipAuthoringSummary(entityId, plants);
}
