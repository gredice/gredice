import * as THREE from 'three';
import type { PlantDefinition } from '../lib/plant-definitions';
import type {
    PlantLodSummary,
    PlantRenderData,
    PlantStemSegment,
} from '../lib/plantRenderData';
import { SeededRNG } from '../lib/rng';
import { resolveVegetableColor } from '../lib/vegetableRenderMetadata';
import type {
    DevelopmentalPlantGraph,
    PlantOrgan,
    PlantOrganTransform,
    PlantSegmentOrgan,
    PlantVector3,
} from './developmentalPlantGraph';

interface BuildDevelopmentalPlantRenderDataOptions {
    flowerGrowth: number;
    fruitGrowth: number;
    graph: DevelopmentalPlantGraph;
    plantDefinition: PlantDefinition;
    renderDetailedGeometry: boolean;
    showFlowers?: boolean;
    showLeaves?: boolean;
    showProduce?: boolean;
}

const STEM_UP = new THREE.Vector3(0, 1, 0);
const MIN_VISIBLE_SCALE = 0.001;

interface OrganAttachment {
    current: THREE.Vector3;
    mature: THREE.Vector3;
}

function toVector3(value: PlantVector3) {
    return new THREE.Vector3(value[0], value[1], value[2]);
}

function toMatrix(
    transform: PlantOrganTransform,
    position: THREE.Vector3,
    scaleMultiplier = 1,
) {
    return new THREE.Matrix4().compose(
        position,
        new THREE.Quaternion().setFromEuler(
            new THREE.Euler(
                transform.rotationRadians[0],
                transform.rotationRadians[1],
                transform.rotationRadians[2],
                'YXZ',
            ),
        ),
        new THREE.Vector3(
            transform.scale[0] * scaleMultiplier,
            transform.scale[1] * scaleMultiplier,
            transform.scale[2] * scaleMultiplier,
        ),
    );
}

function toStemSegment(
    organ: PlantSegmentOrgan,
    start: THREE.Vector3,
    end: THREE.Vector3,
    visibleGrowth: number,
): PlantStemSegment | null {
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length <= MIN_VISIBLE_SCALE) {
        return null;
    }

    const quaternion = new THREE.Quaternion().setFromUnitVectors(
        STEM_UP,
        direction.normalize(),
    );

    return {
        endRadius: organ.endRadius * visibleGrowth,
        matrix: new THREE.Matrix4().compose(
            start,
            quaternion,
            new THREE.Vector3(1, length, 1),
        ),
        startRadius: organ.startRadius * visibleGrowth,
    };
}

function getParentOffset(
    organ: PlantOrgan,
    attachmentByOrganId: Map<string, OrganAttachment>,
) {
    if (!organ.parentId) {
        return new THREE.Vector3();
    }

    const parentAttachment = attachmentByOrganId.get(organ.parentId);
    if (!parentAttachment) {
        throw new TypeError(
            `Plant organ ${organ.id} cannot render before its parent ${organ.parentId}`,
        );
    }

    return parentAttachment.current.clone().sub(parentAttachment.mature);
}

function rememberTranslatedAttachment(
    organId: string,
    maturePosition: PlantVector3,
    parentOffset: THREE.Vector3,
    attachmentByOrganId: Map<string, OrganAttachment>,
) {
    const mature = toVector3(maturePosition);
    const current = mature.clone().add(parentOffset);
    attachmentByOrganId.set(organId, { current, mature });
    return current;
}

function getTransformRadius(transform: PlantOrganTransform) {
    return Math.max(transform.scale[0], transform.scale[1], transform.scale[2]);
}

export function buildDevelopmentalPlantRenderData({
    flowerGrowth,
    fruitGrowth,
    graph,
    plantDefinition,
    renderDetailedGeometry,
    showFlowers = true,
    showLeaves = true,
    showProduce = true,
}: BuildDevelopmentalPlantRenderDataOptions): PlantRenderData {
    if (graph.plantKey !== plantDefinition.key) {
        throw new TypeError(
            `Plant ${plantDefinition.name} cannot render a ${graph.plantKey} graph`,
        );
    }

    const stemSegments: PlantStemSegment[] = [];
    const leaves: THREE.Matrix4[] = [];
    const leafColors: THREE.Color[] = [];
    const flowers: THREE.Matrix4[] = [];
    const thorns: THREE.Matrix4[] = [];
    const vegetables: PlantRenderData['vegetables'] = [];
    const attachmentByOrganId = new Map<string, OrganAttachment>();
    const baseLeafColor = new THREE.Color(plantDefinition.leaf.color);
    const senescentLeafColor = new THREE.Color('#9b783d');
    const dominantColor = new THREE.Color(plantDefinition.stem.color);
    let maxHeight = 0.12;
    let maxHorizontalReach = 0.06;
    let maxStemRadius = plantDefinition.stem.minRadius;
    let foliageSamples = 0;
    let foliageSumY = 0;
    let accentSamples = 0;
    let accentSumY = 0;
    const accentColorSum = new THREE.Color(0, 0, 0);
    let accentColorWeight = 0;

    const trackAccentColor = (color: THREE.Color, radius: number) => {
        const weight = Math.max(radius * radius, Number.EPSILON);
        accentColorSum.r += color.r * weight;
        accentColorSum.g += color.g * weight;
        accentColorSum.b += color.b * weight;
        accentColorWeight += weight;
    };

    const trackPosition = (position: THREE.Vector3, radius = 0) => {
        maxHeight = Math.max(maxHeight, position.y + radius);
        maxHorizontalReach = Math.max(
            maxHorizontalReach,
            Math.hypot(position.x, position.z) + radius,
        );
    };

    for (const organ of graph.organs) {
        const parentOffset = getParentOffset(organ, attachmentByOrganId);
        switch (organ.type) {
            case 'internode':
            case 'branch':
            case 'petiole':
            case 'runner':
            case 'tendril': {
                const visibleGrowth = organ.developmentStage * organ.health;
                const matureStart = toVector3(organ.start);
                const start = matureStart.clone().add(parentOffset);
                const end = toVector3(organ.end)
                    .sub(matureStart)
                    .multiplyScalar(visibleGrowth)
                    .add(start);
                attachmentByOrganId.set(organ.id, {
                    current: end,
                    mature: toVector3(organ.end),
                });
                trackPosition(start, organ.startRadius);
                trackPosition(end, organ.endRadius);
                maxStemRadius = Math.max(
                    maxStemRadius,
                    organ.startRadius,
                    organ.endRadius,
                );
                if (!renderDetailedGeometry) {
                    break;
                }

                const segment = toStemSegment(organ, start, end, visibleGrowth);
                if (segment) {
                    stemSegments.push(segment);
                }
                break;
            }
            case 'leaf': {
                const position = rememberTranslatedAttachment(
                    organ.id,
                    organ.transform.position,
                    parentOffset,
                    attachmentByOrganId,
                );
                const visibleGrowth = organ.developmentStage * organ.health;
                if (!showLeaves || visibleGrowth <= 0.01) {
                    break;
                }

                const radius =
                    getTransformRadius(organ.transform) * organ.health;
                foliageSamples += 1;
                foliageSumY += position.y;
                trackPosition(position, radius);
                const leafRng = new SeededRNG(
                    `${graph.seed}:${graph.plantKey}:organ-renderer:${organ.id}`,
                );
                const color = baseLeafColor
                    .clone()
                    .offsetHSL(
                        leafRng.nextRange(-0.025, 0.025),
                        leafRng.nextRange(-0.07, 0.045),
                        leafRng.nextRange(-0.035, 0.025),
                    )
                    .lerp(senescentLeafColor, (1 - organ.health) * 0.82);
                if (renderDetailedGeometry) {
                    leaves.push(
                        toMatrix(organ.transform, position, organ.health),
                    );
                    leafColors.push(color);
                }
                break;
            }
            case 'flower': {
                const position = rememberTranslatedAttachment(
                    organ.id,
                    organ.transform.position,
                    parentOffset,
                    attachmentByOrganId,
                );
                const visibleGrowth = organ.developmentStage * flowerGrowth;
                if (!showFlowers || visibleGrowth <= 0.01) {
                    break;
                }

                const radius =
                    getTransformRadius(organ.transform) * flowerGrowth;
                accentSamples += 1;
                accentSumY += position.y;
                trackAccentColor(
                    new THREE.Color(plantDefinition.flower.color),
                    radius,
                );
                trackPosition(position, radius);
                if (renderDetailedGeometry) {
                    flowers.push(
                        toMatrix(organ.transform, position, flowerGrowth),
                    );
                }
                break;
            }
            case 'fruit':
            case 'root': {
                const position = rememberTranslatedAttachment(
                    organ.id,
                    organ.transform.position,
                    parentOffset,
                    attachmentByOrganId,
                );
                const visibleGrowth = organ.developmentStage * fruitGrowth;
                if (!showProduce || visibleGrowth <= 0.01) {
                    break;
                }

                const radius =
                    getTransformRadius(organ.transform) * visibleGrowth;
                const color = new THREE.Color(
                    resolveVegetableColor(
                        organ.produceType,
                        organ.developmentStage,
                    ),
                );
                accentSamples += 1;
                accentSumY += Math.max(0.04, position.y);
                trackAccentColor(color, radius);
                trackPosition(position, radius);
                if (renderDetailedGeometry) {
                    vegetables.push({
                        color,
                        growth: visibleGrowth,
                        matrix: toMatrix(organ.transform, position),
                        type: organ.produceType,
                    });
                }
                break;
            }
            case 'thorn': {
                const position = rememberTranslatedAttachment(
                    organ.id,
                    organ.transform.position,
                    parentOffset,
                    attachmentByOrganId,
                );
                if (organ.developmentStage <= 0.01) {
                    break;
                }

                const radius = getTransformRadius(organ.transform);
                trackPosition(position, radius);
                if (renderDetailedGeometry) {
                    thorns.push(toMatrix(organ.transform, position));
                }
                break;
            }
            case 'meristem': {
                const position = rememberTranslatedAttachment(
                    organ.id,
                    organ.position,
                    parentOffset,
                    attachmentByOrganId,
                );
                trackPosition(position);
                break;
            }
        }
    }

    const accentColor =
        accentColorWeight > 0
            ? `#${accentColorSum
                  .multiplyScalar(1 / accentColorWeight)
                  .getHexString()}`
            : undefined;

    dominantColor.lerp(baseLeafColor, showLeaves ? 0.68 : 0.2);
    if (accentColor) {
        dominantColor.lerp(new THREE.Color(accentColor), 0.16);
    }

    const canopyWidth =
        showLeaves && foliageSamples > 0
            ? Math.max(maxHorizontalReach * 2, 0.22)
            : Math.max(maxHorizontalReach * 1.15, maxStemRadius * 5, 0.12);
    const height = Math.max(maxHeight, 0.24);
    const lodSummary: PlantLodSummary = {
        accentCenterY:
            accentSamples > 0
                ? Math.max(0.08, accentSumY / accentSamples)
                : Math.max(height * 0.7, 0.12),
        accentColor,
        canopyCenterY:
            showLeaves && foliageSamples > 0
                ? foliageSumY / foliageSamples
                : Math.max(height * 0.66, 0.16),
        canopyWidth,
        dominantColor: `#${dominantColor.getHexString()}`,
        foliageColor: plantDefinition.leaf.color,
        hasFoliage: showLeaves && foliageSamples > 0,
        height,
        stemColor: plantDefinition.stem.color,
        stemWidth: Math.max(maxStemRadius * 4.5, 0.05),
    };

    return {
        flowers,
        leafColors,
        leaves,
        lodSummary,
        stemSegments,
        thorns,
        vegetables,
    };
}
