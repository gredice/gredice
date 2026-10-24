/** Finite album acknowledgements, not evidence of a physical garden discovery. */
export const autumnActivityMotifs = [
    { id: 'maple-leaf', name: 'Javorov list', kind: 'leaf' },
    { id: 'oak-leaf', name: 'Hrastov list', kind: 'leaf' },
    { id: 'birch-leaf', name: 'Brezin list', kind: 'leaf' },
    { id: 'acorn', name: 'Žir', kind: 'acorn' },
    { id: 'acorn-pair', name: 'Par žireva', kind: 'acorn' },
    { id: 'acorn-cap', name: 'Kapica žira', kind: 'acorn' },
] satisfies { id: string; name: string; kind: 'leaf' | 'acorn' }[];

export const autumnActivityMinimumWindowMs = 28 * 24 * 60 * 60 * 1000;
export function getAutumnActivityEventStatus(
    campaign: { startsAt: string; endsAt: string },
    now: Date,
): 'upcoming' | 'active' | 'ended' {
    const time = now.getTime();
    if (!Number.isFinite(time)) throw new Error('Invalid activity clock');
    if (time < Date.parse(campaign.startsAt)) return 'upcoming';
    return time < Date.parse(campaign.endsAt) ? 'active' : 'ended';
}
