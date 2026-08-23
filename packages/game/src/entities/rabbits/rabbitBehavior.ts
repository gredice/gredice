export type RabbitSettledBehavior = 'groom' | 'nibble' | 'sit' | 'sniff';

export const rabbitFleeDistance = 1.75;
export const rabbitFleeSafeDistance = 3.1;
export const rabbitHomeRange = 5.5;
export const rabbitHopSpeed = 0.82;
export const rabbitFleeHopSpeed = 2.15;

const behaviorThresholds = [
    { behavior: 'sit', threshold: 0.33 },
    { behavior: 'sniff', threshold: 0.59 },
    { behavior: 'groom', threshold: 0.79 },
    { behavior: 'nibble', threshold: 1 },
] satisfies { behavior: RabbitSettledBehavior; threshold: number }[];

const dwellRanges = {
    groom: [2.6, 4.6],
    nibble: [2.1, 4.1],
    sit: [3.2, 6.8],
    sniff: [1.4, 3.2],
} satisfies Record<RabbitSettledBehavior, readonly [number, number]>;

export function pickRabbitSettledBehavior(random: () => number) {
    const roll = random();
    return (
        behaviorThresholds.find(({ threshold }) => roll < threshold)
            ?.behavior ?? 'sit'
    );
}

export function getRabbitDwellSeconds(
    behavior: RabbitSettledBehavior,
    random: () => number,
) {
    const [minimum, maximum] = dwellRanges[behavior];
    return minimum + (maximum - minimum) * random();
}

export function shouldRabbitRoam(random: () => number) {
    return random() < 0.42;
}
