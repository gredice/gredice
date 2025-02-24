import { useEffect } from "react";
import { useGameState } from "./useGameState";
import { useCurrentGarden } from "./hooks/useCurrentGarden";
import { Environment } from "./scene/Environment";
import { EntityFactory } from "./entities/EntityFactory";
import { Vector3 } from "three";
import { Stack } from "./types/Stack";

export function GardenDisplay({ noBackground }: { noBackground?: boolean }) {
    const stacks = useGameState(state => state.stacks);
    const setGarden = useGameState(state => state.setGarden);

    // TODO: Load garden from remote
    const { data: garden, isLoading: isLoadingGarden } = useCurrentGarden();
    useEffect(() => {
        // Only update local state if we don't have any local state (first load or no stacks)
        if (garden && !isLoadingGarden) {
            const rootStacks = garden.stacks ?? [];
            const stacks: Stack[] = [];

            const xPositions = Object.keys(rootStacks);
            for (const x of xPositions) {
                const yPositions = Object.keys(rootStacks[x]);
                for (const y of yPositions) {
                    const blocks = rootStacks[x][y];
                    stacks.push({
                        position: new Vector3(Number(x), 0, Number(y)),
                        blocks: blocks ? blocks.map((block) => {
                            return {
                                id: block.id,
                                name: block.name,
                                rotation: block.rotation ?? 0,
                                variant: block.variant
                            }
                        }) : []
                    });
                }
            }

            console.log('Setting garden', garden);
            setGarden({
                id: garden.id.toString(),
                name: garden.name,
                stacks: stacks,
                location: {
                    lat: garden.latitude,
                    lon: garden.longitude
                }
            });
        }
    }, [garden, isLoadingGarden]);

    if (!garden) {
        return null;
    }

    return (
        <>
            <Environment noBackground={noBackground} location={{ lat: garden.latitude, lon: garden.longitude }} />
            <group>
                {stacks.map((stack) =>
                    stack.blocks?.map((block, i) => {
                        return (
                            <EntityFactory
                                key={`${stack.position.x}|${stack.position.y}|${stack.position.z}|${block.id}-${block.name}-${i}`}
                                name={block.name}
                                stack={stack}
                                block={block}
                                rotation={block.rotation}
                                variant={block.variant} />
                        );
                    })
                )}
            </group>
        </>
    )
}
