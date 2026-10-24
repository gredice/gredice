import { getSeasonDebugMilestones } from './seasonDebugMilestones';

export { getSeasonDebugMilestones } from './seasonDebugMilestones';

/** Fresh local-noon dates, derived from the same milestones used by the HUD. */
export function getSeasonDebugDates(year = 2024) {
    const milestones = getSeasonDebugMilestones(year);
    function dateFor(key: string) {
        const milestone = milestones.find((entry) => entry.key === key);
        if (!milestone) throw new Error(`Unknown seasonal debug date: ${key}`);
        const date = new Date(milestone.date);
        date.setHours(12, 0, 0, 0);
        return date;
    }
    return {
        spring: dateFor('spring'),
        summer: dateFor('summer'),
        earlyAutumn: dateFor('autumn'),
        midAutumn: dateFor('mid-autumn'),
        lateAutumn: dateFor('late-autumn'),
        winter: dateFor('winter'),
    };
}
