export type SquirrelBehavior =
    | 'scamper'
    | 'bound'
    | 'sit'
    | 'forage'
    | 'pause'
    | 'flee';

export type SquirrelRoutineBehavior = Exclude<SquirrelBehavior, 'flee'>;

type WeightedBehavior = {
    behavior: SquirrelRoutineBehavior;
    weight: number;
};

const routineBehaviorWeights = [
    { behavior: 'scamper', weight: 0.28 },
    { behavior: 'bound', weight: 0.18 },
    { behavior: 'sit', weight: 0.2 },
    { behavior: 'forage', weight: 0.24 },
    { behavior: 'pause', weight: 0.1 },
] satisfies WeightedBehavior[];

export function getSquirrelBehaviorWeights() {
    return routineBehaviorWeights;
}

export function pickSquirrelRoutineBehavior(
    random: () => number,
): SquirrelRoutineBehavior {
    const totalWeight = routineBehaviorWeights.reduce(
        (total, item) => total + item.weight,
        0,
    );
    let threshold = random() * totalWeight;

    for (const item of routineBehaviorWeights) {
        threshold -= item.weight;
        if (threshold <= 0) {
            return item.behavior;
        }
    }

    return 'pause';
}

export function getSquirrelDwellSeconds({
    behavior,
    random,
}: {
    behavior: Extract<SquirrelRoutineBehavior, 'sit' | 'forage' | 'pause'>;
    random: () => number;
}) {
    if (behavior === 'forage') {
        return 3.5 + random() * 4.5;
    }
    if (behavior === 'sit') {
        return 3 + random() * 5;
    }
    return 1.6 + random() * 2.8;
}

export function getSquirrelMovementRange(behavior: SquirrelBehavior) {
    if (behavior === 'bound') {
        return 1.8;
    }
    if (behavior === 'flee') {
        return Number.POSITIVE_INFINITY;
    }
    return 4;
}
