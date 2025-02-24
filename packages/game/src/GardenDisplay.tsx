import { useEffect } from "react";
import { useGameState } from "./useGameState";
import { useCurrentGarden } from "./hooks/useCurrentGarden";
import { Environment } from "./scene/Environment";
import { EntityFactory } from "./entities/EntityFactory";

export type GardenDisplayProps = {
    noBackground?: boolean,
    noWeather?: boolean,
    noSound?: boolean,
    mockGarden?: boolean,
}

export function GardenDisplay({ noBackground, noWeather, noSound, mockGarden }: GardenDisplayProps) {
    const stacks = useGameState(state => state.stacks);
    const setGarden = useGameState(state => state.setGarden);

    // TODO: Load garden from remote
    const { data: garden } = useCurrentGarden(mockGarden);
    useEffect(() => {
        // Only update local state if we don't have any local state (first load or no stacks)
        if (garden) {
            console.log('Setting garden', garden);
            setGarden(garden);
        }
    }, [garden]);

    if (!garden) {
        return null;
    }

    return (
        <>
            <Environment
                noBackground={noBackground}
                noWeather={noWeather}
                noSound={noSound}
                location={{ lat: garden.location.lat, lon: garden.location.lon }} />
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
