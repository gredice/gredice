import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createBatRandom,
    resolveBatLifecyclePhase,
    shouldBatGlide,
} from '../bats/batBehavior';
import {
    getBeeDwellSeconds,
    getBeeWanderHoverSeconds,
    shouldBeeWanderNext,
} from '../bees/beeBehavior';
import { getBirdDwellSeconds, pickBirdBehavior } from '../birds/birdBehavior';
import {
    createSeededButterflyRandom,
    getButterflyRestSeconds,
    shouldButterflyApproachFlower,
} from '../butterflies/butterflyBehavior';
import { getCatDwellSeconds, pickCatBehavior } from '../cats/catBehavior';
import { getCowDwellSeconds, pickCowBehavior } from '../cows/cowBehavior';
import { createCowRandom } from '../cows/cowNavigation';
import { getDogDwellSeconds, pickDogBehavior } from '../dogs/dogBehavior';
import {
    type FarmAnimalSpecies,
    getFarmAnimalDwellSeconds,
    pickFarmAnimalBehavior,
} from '../farmAnimals/farmAnimalBehavior';
import {
    getFrogBlinkDelaySeconds,
    getFrogCroakDelaySeconds,
    getFrogDwellSeconds,
    getFrogHopDurationSeconds,
    getFrogHopMotion,
} from '../frogs/frogBehavior';
import {
    createHorseRandom,
    getHorseDwellSeconds,
    pickHorseSettledBehavior,
} from '../horses/horseBehavior';
import {
    createLadybugRandom,
    getLadybugCrawlSeconds,
    getLadybugPauseSeconds,
    shouldLadybugTakeFlight,
} from '../ladybugs/ladybugBehavior';
import {
    getRabbitDwellSeconds,
    pickRabbitSettledBehavior,
    shouldRabbitRoam,
} from '../rabbits/rabbitBehavior';
import { chooseSlugBehavior } from '../slugs/slugBehavior';
import type { SlugHabitatCandidate } from '../slugs/slugEcology';
import {
    getSquirrelDwellSeconds,
    getSquirrelMovementRange,
    pickSquirrelRoutineBehavior,
} from '../squirrels/squirrelBehavior';
import {
    createFaunaSimulation,
    faunaSimulationStepSeconds,
} from './faunaSimulation';

type Decision = {
    behavior: string;
    dwellSeconds: number;
    detail?: unknown;
};
type DecisionFactory = () => (now: number) => Decision;

function conditions(now: number) {
    return {
        timeOfDay: now < 180 ? 0.5 : 0.9,
        weather: { rainy: now >= 90 && now < 180 ? 0.8 : 0 },
    };
}

const factories = new Map<string, DecisionFactory>([
    [
        'Cow',
        () => {
            const random = createCowRandom(4720);
            return () => {
                const behavior = pickCowBehavior(random);
                return {
                    behavior,
                    dwellSeconds: getCowDwellSeconds(behavior, random),
                };
            };
        },
    ],
    [
        'Cat',
        () => {
            const random = createCowRandom(4720);
            return (now) => {
                const input = { ...conditions(now), availability: {}, random };
                const behavior = pickCatBehavior(input);
                return {
                    behavior,
                    dwellSeconds: getCatDwellSeconds({ ...input, behavior }),
                };
            };
        },
    ],
    [
        'Dog',
        () => {
            const random = createCowRandom(4720);
            return (now) => {
                const input = { ...conditions(now), availability: {}, random };
                const behavior = pickDogBehavior(input);
                return {
                    behavior,
                    dwellSeconds: getDogDwellSeconds({ ...input, behavior }),
                };
            };
        },
    ],
    [
        'Bird',
        () => {
            const random = createCowRandom(4720);
            return (now) => {
                const { timeOfDay } = conditions(now);
                const behavior = pickBirdBehavior(timeOfDay, {}, random);
                return {
                    behavior,
                    dwellSeconds: getBirdDwellSeconds(
                        behavior,
                        timeOfDay,
                        random,
                    ),
                };
            };
        },
    ],
    [
        'Bee',
        () => {
            const random = createCowRandom(4720);
            let currentlyWandering = false;
            return () => {
                currentlyWandering = shouldBeeWanderNext({
                    currentlyWandering,
                    otherFlowerCount: 3,
                    random,
                });
                return {
                    behavior: currentlyWandering ? 'wander' : 'forage',
                    dwellSeconds: currentlyWandering
                        ? getBeeWanderHoverSeconds(random)
                        : getBeeDwellSeconds(random),
                };
            };
        },
    ],
    [
        'Bat',
        () => {
            const random = createBatRandom(4720);
            let completedSegments = 0;
            let phase: Parameters<typeof resolveBatLifecyclePhase>[0]['phase'] =
                'hidden';
            return (now) => {
                phase = resolveBatLifecyclePhase({
                    active: now < 180,
                    phase,
                    reachedTarget: true,
                });
                const gliding = shouldBatGlide(random, completedSegments++);
                return {
                    behavior: phase,
                    dwellSeconds: 1.2 + random(),
                    detail: gliding,
                };
            };
        },
    ],
    [
        'Butterfly',
        () => {
            const random = createSeededButterflyRandom(4720);
            return () => ({
                behavior: shouldButterflyApproachFlower(random)
                    ? 'approaching'
                    : 'meander',
                dwellSeconds: getButterflyRestSeconds(random),
            });
        },
    ],
    [
        'Ladybug',
        () => {
            const random = createLadybugRandom(4720);
            return () => {
                const flying = shouldLadybugTakeFlight(random);
                return {
                    behavior: flying ? 'flight' : 'crawl',
                    dwellSeconds: flying
                        ? getLadybugPauseSeconds(random)
                        : getLadybugCrawlSeconds(random),
                };
            };
        },
    ],
    [
        'Frog',
        () => {
            const random = createCowRandom(4720);
            return () => {
                const distance = 1 + random() * 2;
                const escaping = random() < 0.25;
                return {
                    behavior: escaping ? 'escape' : 'hop',
                    dwellSeconds:
                        getFrogDwellSeconds(random) +
                        getFrogHopDurationSeconds({
                            distance,
                            escape: escaping,
                        }),
                    detail: {
                        blinkDelay: getFrogBlinkDelaySeconds(random),
                        croakDelay: getFrogCroakDelaySeconds(random),
                        motion: [0.1, 0.4, 0.8, 1].map((progress) =>
                            getFrogHopMotion({
                                distance,
                                escape: escaping,
                                progress,
                            }),
                        ),
                    },
                };
            };
        },
    ],
    [
        'Horse',
        () => {
            const random = createHorseRandom('parity-horse-4720');
            return (now) => {
                const behavior = pickHorseSettledBehavior({
                    avatarDistance: now > 120 && now < 180 ? 1.5 : null,
                    random,
                });
                return {
                    behavior,
                    dwellSeconds: getHorseDwellSeconds(behavior, random),
                };
            };
        },
    ],
    [
        'Rabbit',
        () => {
            const random = createCowRandom(4720);
            return () => {
                const behavior = pickRabbitSettledBehavior(random);
                return {
                    behavior,
                    dwellSeconds: getRabbitDwellSeconds(behavior, random),
                    detail: shouldRabbitRoam(random),
                };
            };
        },
    ],
    [
        'Squirrel',
        () => {
            const random = createCowRandom(4720);
            return () => {
                const behavior = pickSquirrelRoutineBehavior(random);
                const moving = behavior === 'scamper' || behavior === 'bound';
                return {
                    behavior,
                    dwellSeconds: moving
                        ? getSquirrelMovementRange(behavior)
                        : getSquirrelDwellSeconds({ behavior, random }),
                    detail: getSquirrelMovementRange(behavior),
                };
            };
        },
    ],
    [
        'Slug',
        () => {
            function candidate(
                id: string,
                x: number,
                moisture: number,
            ): SlugHabitatCandidate {
                return {
                    blocked: false,
                    id,
                    moisture,
                    path: false,
                    score: moisture,
                    shaded: true,
                    suitablePlantNearby: true,
                    terrainName: 'Ground',
                    water: false,
                    x,
                    y: 0,
                    z: 0,
                };
            }
            const habitat = [
                candidate('dry', 0, 0.5),
                candidate('wet', 1, 0.9),
                candidate('cover', 2, 0.7),
            ];
            let current = habitat[0];
            let sequence = 0;
            return () => {
                const decision = chooseSlugBehavior({
                    current,
                    habitat,
                    seed: 4720 + sequence++,
                });
                current = decision.target;
                return {
                    behavior: decision.behavior,
                    dwellSeconds: decision.dwellSeconds,
                    detail: decision.target.id,
                };
            };
        },
    ],
]);

const farmSpecies = [
    'Chicken',
    'Goat',
    'Piglet',
    'Sheep',
] satisfies FarmAnimalSpecies[];
for (const species of farmSpecies) {
    factories.set(species, () => {
        const random = createCowRandom(4720);
        return (now) => {
            const input = {
                ...conditions(now),
                availability: {},
                random,
                species,
                followingAvatar: now > 120 && now < 150,
            };
            const behavior = pickFarmAnimalBehavior(input);
            return {
                behavior,
                dwellSeconds: getFarmAnimalDwellSeconds({ ...input, behavior }),
            };
        };
    });
}

function decisionTrace(factory: DecisionFactory, renderFps: number | null) {
    const decide = factory();
    let nextDeadline = 0;
    const trace: { at: number; until: number; decision: Decision }[] = [];
    const tick = (_: null, { now }: { now: number }) => {
        if (now < nextDeadline) return;
        const decision = decide(now);
        nextDeadline =
            now + Math.max(faunaSimulationStepSeconds, decision.dwellSeconds);
        trace.push({
            at: Number(now.toFixed(6)),
            until: Number(nextDeadline.toFixed(6)),
            decision,
        });
    };
    if (renderFps === null) {
        // Legacy ambient schedule: direct species callbacks, one every 1/30 s.
        let now = 0;
        for (let step = 0; step <= 360 * 30; step++) {
            tick(null, { now });
            now += faunaSimulationStepSeconds;
        }
    } else {
        const runtime = createFaunaSimulation<null>();
        runtime.register(tick);
        for (let frame = 0; frame <= 360 * renderFps; frame++) {
            runtime.advance(null, {
                delta: frame === 0 ? 0 : 1 / renderFps,
                now: frame / renderFps,
            });
        }
    }
    return trace;
}

describe('seeded fauna decision and deadline parity', () => {
    for (const [species, factory] of factories) {
        it(`${species} preserves six-minute legacy ambient traces at 30 and 60 render FPS`, () => {
            const legacy = decisionTrace(factory, null);
            assert.ok(
                legacy.length > 5,
                'The witness must exercise repeated real species decisions',
            );
            assert.deepEqual(decisionTrace(factory, 30), legacy);
            assert.deepEqual(decisionTrace(factory, 60), legacy);
        });
    }
});
