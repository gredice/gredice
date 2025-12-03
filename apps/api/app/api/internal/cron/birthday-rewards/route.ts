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
    const currentYear = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();

    let users = await getUsersWithBirthdayOn(month, day);
    if (month === 2 && day === 28 && !isLeapYear(currentYear)) {
        const feb29Users = await getUsersWithBirthdayOn(2, 29);
        users = [...users, ...feb29Users];
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

    for (const user of users) {
        if (!user.birthdayMonth || !user.birthdayDay) {
            skipped.push({ userId: user.id, reason: 'missing_birthday' });
            continue;
        }

        const rewardDate = startOfUtcDay(
            getBirthdayDateForYear(
                user.birthdayMonth,
                user.birthdayDay,
                currentYear,
            ),
        );
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
