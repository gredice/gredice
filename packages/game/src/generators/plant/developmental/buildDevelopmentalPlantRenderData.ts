import * as THREE from 'three';
import type { PlantDefinition } from '../lib/plant-definitions';
import type {
    PlantLodSummary,
    PlantRenderData,
    PlantStemSegment,
} from '../lib/plantRenderData';
import { SeededRNG } from '../lib/rng';
import { vegetableMaterialProps } from '../lib/vegetableRenderMetadata';
import type {
    DevelopmentalPlantGraph,
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

function toVector3(value: PlantVector3) {
    return new THREE.Vector3(value[0], value[1], value[2]);
}

function toMatrix(transform: PlantOrganTransform, scaleMultiplier = 1) {
    return new THREE.Matrix4().compose(
        toVector3(transform.position),
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

function toStemSegment(organ: PlantSegmentOrgan): PlantStemSegment | null {
    const start = toVector3(organ.start);
    const direction = toVector3(organ.end).sub(start);
    const visibleGrowth = organ.developmentStage * organ.health;
    direction.multiplyScalar(visibleGrowth);
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
    let accentColor: string | undefined;

    const trackPosition = (position: PlantVector3, radius = 0) => {
        maxHeight = Math.max(maxHeight, position[1] + radius);
        maxHorizontalReach = Math.max(
            maxHorizontalReach,
            Math.hypot(position[0], position[2]) + radius,
        );
    };

    for (const organ of graph.organs) {
        switch (organ.type) {
            case 'internode':
            case 'branch':
            case 'petiole':
            case 'runner':
            case 'tendril': {
                trackPosition(organ.start, organ.startRadius);
                trackPosition(organ.end, organ.endRadius);
                maxStemRadius = Math.max(
                    maxStemRadius,
                    organ.startRadius,
                    organ.endRadius,
                );
                if (!renderDetailedGeometry) {
                    break;
                }

                const segment = toStemSegment(organ);
                if (segment) {
                    stemSegments.push(segment);
                }
                break;
            }
            case 'leaf': {
                const visibleGrowth = organ.developmentStage * organ.health;
                if (!showLeaves || visibleGrowth <= 0.01) {
                    break;
                }

                const radius =
                    getTransformRadius(organ.transform) * organ.health;
                foliageSamples += 1;
                foliageSumY += organ.transform.position[1];
                trackPosition(organ.transform.position, radius);
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
                    leaves.push(toMatrix(organ.transform, organ.health));
                    leafColors.push(color);
                }
                break;
            }
            case 'flower': {
                const visibleGrowth = organ.developmentStage * flowerGrowth;
                if (!showFlowers || visibleGrowth <= 0.01) {
                    break;
                }

                const radius =
                    getTransformRadius(organ.transform) * flowerGrowth;
                accentSamples += 1;
                accentSumY += organ.transform.position[1];
                accentColor = plantDefinition.flower.color;
                trackPosition(organ.transform.position, radius);
                if (renderDetailedGeometry) {
                    flowers.push(toMatrix(organ.transform, flowerGrowth));
                }
                break;
            }
            case 'fruit':
            case 'root': {
                const visibleGrowth = organ.developmentStage * fruitGrowth;
                if (!showProduce || visibleGrowth <= 0.01) {
                    break;
                }

                const radius =
                    getTransformRadius(organ.transform) * visibleGrowth;
                accentSamples += 1;
                accentSumY += Math.max(0.04, organ.transform.position[1]);
                accentColor = vegetableMaterialProps[organ.produceType].color;
                trackPosition(organ.transform.position, radius);
                if (renderDetailedGeometry) {
                    vegetables.push({
                        growth: visibleGrowth,
                        matrix: toMatrix(organ.transform),
                        type: organ.produceType,
                    });
                }
                break;
            }
            case 'thorn': {
                if (organ.developmentStage <= 0.01) {
                    break;
                }

                const radius = getTransformRadius(organ.transform);
                trackPosition(organ.transform.position, radius);
                if (renderDetailedGeometry) {
                    thorns.push(toMatrix(organ.transform));
                }
                break;
            }
            case 'meristem':
                trackPosition(organ.position);
                break;
        }
    }

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
