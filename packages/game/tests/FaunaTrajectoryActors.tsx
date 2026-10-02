import { Bats } from '../src/entities/bats/Bats';
import { Bees } from '../src/entities/bees/Bees';
import { Birds } from '../src/entities/birds/Birds';
import { Butterflies } from '../src/entities/butterflies/Butterflies';
import { Cow } from '../src/entities/Cow';
import { Cats } from '../src/entities/cats/Cats';
import { Dogs } from '../src/entities/dogs/Dogs';
import {
    Chickens,
    Goats,
    Piglets,
    Sheep,
} from '../src/entities/farmAnimals/FarmAnimals';
import { Frogs } from '../src/entities/frogs/Frogs';
import { Horse } from '../src/entities/horses/Horse';
import { Ladybugs } from '../src/entities/ladybugs/Ladybugs';
import { getHomeSpawnedPersistentPetInstances } from '../src/entities/persistentPets/homeSpawnedPersistentPets';
import type { PollinatorGarden } from '../src/entities/pollinators/flowerTargets';
import { Rabbit } from '../src/entities/rabbits/Rabbit';
import { Slugs } from '../src/entities/slugs/Slugs';
import { Squirrels } from '../src/entities/squirrels/Squirrels';
import type { GameState } from '../src/useGameState';

export function FaunaTrajectoryActors({
    garden,
    weather,
}: {
    garden: PollinatorGarden;
    weather: Partial<NonNullable<GameState['weather']>>;
}) {
    const { stacks } = garden;
    return (
        <>
            <group name="witness:Cat">
                <Cats stacks={stacks} weather={weather} />
            </group>
            <group name="witness:Dog">
                <Dogs stacks={stacks} weather={weather} />
            </group>
            <group name="witness:Bird">
                <Birds stacks={stacks} />
            </group>
            <group name="witness:Bee">
                <Bees garden={garden} weather={weather} />
            </group>
            <group name="witness:Bat">
                <Bats stacks={stacks} gardenId={garden.id} weather={weather} />
            </group>
            <group name="witness:Butterfly">
                <Butterflies garden={garden} weather={weather} />
            </group>
            <group name="witness:Ladybug">
                <Ladybugs garden={garden} weather={weather} />
            </group>
            <group name="witness:Frog">
                <Frogs stacks={stacks} gardenId={garden.id} />
            </group>
            <group name="witness:Squirrel">
                <Squirrels stacks={stacks} seasonalEffectsEnabled />
            </group>
            <group name="witness:Slug">
                <Slugs
                    garden={garden}
                    spawnSeed="4715-actual-trajectory"
                    weather={weather}
                />
            </group>
            <group name="witness:Chicken">
                <Chickens stacks={stacks} weather={weather} />
            </group>
            <group name="witness:Goat">
                <Goats stacks={stacks} weather={weather} />
            </group>
            <group name="witness:Piglet">
                <Piglets stacks={stacks} weather={weather} />
            </group>
            <group name="witness:Sheep">
                <Sheep stacks={stacks} weather={weather} />
            </group>
            {getHomeSpawnedPersistentPetInstances(stacks).map(
                ({ block, name, stack }) => {
                    const props = {
                        block,
                        stack,
                        stacks,
                        rotation: block.rotation,
                        variant: block.variant,
                    };
                    if (name === 'CowShelter')
                        return (
                            <group key={block.id} name="witness:Cow">
                                <Cow {...props} />
                            </group>
                        );
                    if (name === 'HorseStable')
                        return (
                            <group key={block.id} name="witness:Horse">
                                <Horse {...props} />
                            </group>
                        );
                    return (
                        <group key={block.id} name="witness:Rabbit">
                            <Rabbit {...props} />
                        </group>
                    );
                },
            )}
        </>
    );
}
