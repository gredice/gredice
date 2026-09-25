import { getSeasonDebugDates } from '../src/scene/seasonDebugDates';

const dates = getSeasonDebugDates(2026);
function springDays(days: number) {
    const date = new Date(dates.spring);
    date.setDate(date.getDate() + days);
    return date;
}

export const autumnShrubReviewCases = {
    summer: { date: dates.summer },
    earlyAutumn: { date: dates.earlyAutumn },
    autumn: { date: dates.midAutumn },
    lateAutumn: { date: dates.lateAutumn },
    winter: { date: dates.winter },
    springBuds: { date: springDays(10) },
    spring: { date: springDays(28) },
    springFull: { date: springDays(64) },
    disabled: { date: dates.winter },
    rain: { date: dates.midAutumn },
    snow: { date: dates.winter },
};

export type AutumnShrubReviewCase = keyof typeof autumnShrubReviewCases;
