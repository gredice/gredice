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

    for (let offset = 0; offset <= lookbackDays; offset += 1) {
        const candidateDate = new Date(referenceDate);
        candidateDate.setUTCDate(candidateDate.getUTCDate() - offset);
        const candidateMonth = candidateDate.getUTCMonth() + 1;
        const candidateDay = candidateDate.getUTCDate();
        const candidateYear = candidateDate.getUTCFullYear();

        const dayUsers = await getUsersWithBirthdayOn(
            candidateMonth,
            candidateDay,
        );
        for (const user of dayUsers) {
            if (seenUsers.has(user.id)) {
                continue;
            }
            usersWithRewardDates.push({
                user,
                rewardDate: startOfUtcDay(
                    getBirthdayDateForYear(
                        candidateMonth,
                        candidateDay,
                        candidateYear,
                    ),
                ),
            });
            seenUsers.add(user.id);
        }

        if (
            candidateMonth === 2 &&
            candidateDay === 28 &&
            !isLeapYear(candidateYear)
        ) {
            const feb29Users = await getUsersWithBirthdayOn(2, 29);
            for (const user of feb29Users) {
                if (seenUsers.has(user.id)) {
                    continue;
                }
                usersWithRewardDates.push({
                    user,
                    rewardDate: startOfUtcDay(
                        getBirthdayDateForYear(2, 29, candidateYear),
                    ),
                });
                seenUsers.add(user.id);
            }
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
        if (!user.birthdayMonth || !user.birthdayDay) {
            skipped.push({ userId: user.id, reason: 'missing_birthday' });
            continue;
        }
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
