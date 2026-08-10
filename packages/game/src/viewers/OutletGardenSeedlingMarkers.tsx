'use client';

import { useMemo } from 'react';
import { useBlockData } from '../hooks/useBlockData';
import { getStackHeight } from '../utils/getStackHeight';
import {
    type OutletGardenLayoutOffer,
    outletOfferIdFromBlockId,
} from './outletGardenLayout';
import {
    normalizePublicGardenStacks,
    type PublicGardenDetail,
    publicGardenStacksFromResponse,
} from './PublicGardenViewer';

const seedlingLeafColors = [
    '#4f8f3a',
    '#6f9f3b',
    '#3f7f35',
    '#7a9f45',
    '#3f8d58',
] as const;
const ignorePointerRaycast = () => undefined;

export function OutletGardenSeedlingMarkers({
    offers,
    stacks,
}: {
    offers: readonly OutletGardenLayoutOffer[];
    stacks: PublicGardenDetail['stacks'];
}) {
    const { data: blockData } = useBlockData();
    const markers = useMemo(() => {
        const offersById = new Map(offers.map((offer) => [offer.id, offer]));
        const normalizedStacks = normalizePublicGardenStacks(
            publicGardenStacksFromResponse(stacks),
        );

        return normalizedStacks.flatMap((stack) =>
            stack.blocks.flatMap((block) => {
                const offerId = outletOfferIdFromBlockId(block.id);
                if (offerId === null) {
                    return [];
                }
                const offer = offersById.get(offerId);
                if (!offer) {
                    return [];
                }
                const plantVisualId = offer.plantId ?? offer.plantSortId;

                return [
                    {
                        color:
                            seedlingLeafColors[
                                Math.abs(plantVisualId) %
                                    seedlingLeafColors.length
                            ] ?? seedlingLeafColors[0],
                        id: offerId,
                        position: stack.position
                            .clone()
                            .setY(getStackHeight(blockData, stack)),
                        rotation: ((offer.plantSortId % 8) * Math.PI) / 4,
                        scale: 0.92 + (Math.abs(offer.plantSortId) % 3) * 0.08,
                    },
                ];
            }),
        );
    }, [blockData, offers, stacks]);

    return (
        <group name="OutletGardenSeedlingMarkers">
            {markers.map((marker) => (
                <group
                    key={marker.id}
                    position={marker.position}
                    rotation={[0, marker.rotation, 0]}
                    scale={marker.scale}
                >
                    <mesh
                        castShadow
                        position={[0, 0.26, 0]}
                        raycast={ignorePointerRaycast}
                    >
                        <cylinderGeometry args={[0.025, 0.035, 0.52, 6]} />
                        <meshStandardMaterial color="#3d7a32" roughness={0.9} />
                    </mesh>
                    <mesh
                        castShadow
                        position={[0.1, 0.39, 0]}
                        raycast={ignorePointerRaycast}
                        rotation={[0, 0, -0.45]}
                        scale={[1, 0.28, 0.55]}
                    >
                        <sphereGeometry args={[0.15, 8, 6]} />
                        <meshStandardMaterial
                            color={marker.color}
                            roughness={0.86}
                        />
                    </mesh>
                    <mesh
                        castShadow
                        position={[-0.1, 0.51, 0.02]}
                        raycast={ignorePointerRaycast}
                        rotation={[0, 0, 0.45]}
                        scale={[1, 0.28, 0.55]}
                    >
                        <sphereGeometry args={[0.15, 8, 6]} />
                        <meshStandardMaterial
                            color={marker.color}
                            roughness={0.86}
                        />
                    </mesh>
                </group>
            ))}
        </group>
    );
}
