import {
    getLastBirthdayRewardEvent,
    getUsersWithBirthdayOn,
} from '@gredice/storage';
import type { NextRequest } from 'next/server';
import {
    type BirthdayRewardUser,
    grantBirthdayReward,
} from '../../../../../lib/users/birthdayRewards';
import {
    differenceInCalendarDays,
    getBirthdayDateForYear,
    isLeapYear,
    startOfUtcDay,
} from '../../../../../lib/users/birthdayUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', {
            status: 401,
        });
    }

    const now = new Date();
    const referenceDate = startOfUtcDay(now);
    const lookbackDays = 30;
    const usersWithRewardDates: {
        user: Awaited<ReturnType<typeof getUsersWithBirthdayOn>>[number];
        rewardDate: Date;
    }[] = [];
    const seenUsers = new Set<string>();

    const candidates: { month: number; day: number; year: number }[] = [];
    for (let offset = 0; offset <= lookbackDays; offset += 1) {
        const candidateDate = new Date(referenceDate);
        candidateDate.setUTCDate(candidateDate.getUTCDate() - offset);
        const candidateMonth = candidateDate.getUTCMonth() + 1;
        const candidateDay = candidateDate.getUTCDate();
        const candidateYear = candidateDate.getUTCFullYear();
        candidates.push({
            month: candidateMonth,
            day: candidateDay,
            year: candidateYear,
        });
        if (
            candidateMonth === 2 &&
            candidateDay === 28 &&
            !isLeapYear(candidateYear)
        ) {
            candidates.push({ month: 2, day: 29, year: candidateYear });
        }
    }

    const queryResults = await Promise.all(
        candidates.map(async ({ month, day, year }) => ({
            users: await getUsersWithBirthdayOn(month, day),
            rewardDate: getBirthdayDateForYear(month, day, year),
        })),
    );

    for (const { users, rewardDate } of queryResults) {
        for (const user of users) {
            if (seenUsers.has(user.id)) {
                continue;
            }
            usersWithRewardDates.push({ user, rewardDate });
            seenUsers.add(user.id);
        }
    }

    const rewarded: {
        userId: string;
        accountId?: string;
        daysLate: number;
    }[] = [];
    const skipped: {
        userId: string;
        reason: string;
    }[] = [];

    for (const { user, rewardDate } of usersWithRewardDates) {
        const lastRewardEvent = await getLastBirthdayRewardEvent(user.id);
        const lastReward = lastRewardEvent
            ? startOfUtcDay(new Date(lastRewardEvent.data.rewardDate))
            : null;
        if (lastReward && lastReward >= rewardDate) {
            skipped.push({ userId: user.id, reason: 'already_rewarded' });
            continue;
        }

        const daysSinceBirthday = differenceInCalendarDays(now, rewardDate);
        if (daysSinceBirthday < 0) {
            skipped.push({ userId: user.id, reason: 'in_future' });
            continue;
        }

        const result = await grantBirthdayReward({
            user: user as BirthdayRewardUser,
            rewardDate,
            isLate: daysSinceBirthday > 0,
        });

        if (result.rewarded) {
            rewarded.push({
                userId: user.id,
                accountId: result.accountId,
                daysLate: daysSinceBirthday,
            });
        } else {
            skipped.push({ userId: user.id, reason: 'no_account' });
        }
    }

    return Response.json({
        success: true,
        rewardedCount: rewarded.length,
        skippedCount: skipped.length,
        rewarded,
        skipped,
        timestamp: new Date().toISOString(),
    });
}
