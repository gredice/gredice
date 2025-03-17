import { useGameState } from "./useGameState";
import { useCurrentGarden } from "./hooks/useCurrentGarden";
import { Environment } from "./scene/Environment";
import { EntityFactory } from "./entities/EntityFactory";
import { GardenLoadingIndicator } from "./GardenLoadingIndicator";

export type GardenDisplayProps = {
    noBackground?: boolean,
    noWeather?: boolean,
    noSound?: boolean,
    mockGarden?: boolean,
}

export function GardenDisplay({ noBackground, noWeather, noSound, mockGarden }: GardenDisplayProps) {
    const weather = useGameState(state => state.weather);

    const { data: garden } = useCurrentGarden(mockGarden);
    if (!garden) {
        return <GardenLoadingIndicator />;
    }

    return (
        <>
            <Environment
                noBackground={noBackground}
                noWeather={noWeather}
                overrideWeather={weather}
                noSound={noSound}
                location={{ lat: garden.location.lat, lon: garden.location.lon }} />
            <group>
                {garden.stacks.map((stack) =>
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
