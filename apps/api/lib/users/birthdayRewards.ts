import {
    createEvent,
    createNotification,
    earnSunflowers,
    knownEvents,
    type SelectUser,
} from '@gredice/storage';
import { sendBirthdayGreeting } from '../email/transactional';
import { webPushNotificationsFlag } from '../flags';
import { differenceInCalendarDays, startOfUtcDay } from './birthdayUtils';

export const BIRTHDAY_REWARD_AMOUNT = 9999;

export type BirthdayRewardUser = SelectUser & {
    accounts: {
        accountId: string;
        createdAt: Date;
    }[];
};

export async function grantBirthdayReward({
    user,
    rewardDate,
    isLate,
}: {
    user: BirthdayRewardUser;
    rewardDate: Date;
    isLate: boolean;
}) {
    const accounts = [...user.accounts].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const primaryAccount = accounts[0];
    if (!primaryAccount) {
        console.warn('Skipping birthday reward for user without account', {
            userId: user.id,
        });
        return { rewarded: false };
    }

    const rewardReason = `birthday:${rewardDate.getUTCFullYear()}`;

    await earnSunflowers(
        primaryAccount.accountId,
        BIRTHDAY_REWARD_AMOUNT,
        rewardReason,
    );

    const header = isLate
        ? 'Sretan rođendan (uz malo zakašnjenje)!'
        : 'Sretan rođendan!';
    const celebrationLine = isLate
        ? 'Sunce nas je malo preteklo, ali poklon je sada tu. 🌞'
        : 'Neka ti vrt bude pun sunca i cvijeća!';
    const content = [
        '🎉 Sretan rođendan! 🎉',
        `Poklanjamo ti **${BIRTHDAY_REWARD_AMOUNT}** 🌻 za proslavu u vrtu.`,
        celebrationLine,
        'Hvala ti što si dio Gredica - uživaj u slavlju! 🌼',
    ].join('\n\n');

    await createNotification(
        {
            accountId: primaryAccount.accountId,
            userId: user.id,
            header,
            content,
            iconUrl: 'https://cdn.gredice.com/sunflower-large.svg',
            timestamp: new Date(),
        },
        { webPushNotificationsEnabled: await webPushNotificationsFlag() },
    );

    const userEmail = user.userName.includes('@') ? user.userName : null;
    if (userEmail) {
        try {
            await sendBirthdayGreeting(userEmail, {
                name: user.displayName ?? undefined,
                sunflowerAmount: BIRTHDAY_REWARD_AMOUNT,
                late: isLate,
            });
        } catch (error) {
            console.error('Failed to send birthday greeting email', {
                userId: user.id,
                error,
            });
        }
    }

    const normalizedRewardDate = startOfUtcDay(rewardDate);
    await createEvent(
        knownEvents.users.birthdayRewardV1(user.id, {
            rewardDate: normalizedRewardDate.toISOString(),
            accountId: primaryAccount.accountId,
            amount: BIRTHDAY_REWARD_AMOUNT,
            late: isLate,
        }),
    );

    const daysDifference = differenceInCalendarDays(new Date(), rewardDate);
    return {
        rewarded: true,
        accountId: primaryAccount.accountId,
        daysLate: daysDifference,
    };
}
