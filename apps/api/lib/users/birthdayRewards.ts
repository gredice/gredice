import {
    createNotification,
    grantBirthdaySunflowers,
    type SelectUser,
} from '@gredice/storage';
import { sendBirthdayGreeting } from '../email/transactional';
import { differenceInCalendarDays, startOfUtcDay } from './birthdayUtils';

export const BIRTHDAY_REWARD_AMOUNT = 9999;
export const BIRTHDAY_REWARD_MIN_ACCOUNT_AGE_DAYS = 30;

export type BirthdayRewardUser = SelectUser & {
    accounts: {
        accountId: string;
        createdAt: Date;
    }[];
};

export type BirthdayRewardResult =
    | {
          rewarded: true;
          accountId: string;
          daysLate: number;
      }
    | {
          rewarded: false;
          reason: 'account_too_new' | 'already_rewarded' | 'no_account';
          accountId?: string;
      };

export function isBirthdayRewardPrimaryAccountEligible({
    accountCreatedAt,
    rewardDate,
}: {
    accountCreatedAt: Date;
    rewardDate: Date;
}) {
    const accountCreatedDay = startOfUtcDay(accountCreatedAt);
    const rewardDay = startOfUtcDay(rewardDate);
    return (
        differenceInCalendarDays(rewardDay, accountCreatedDay) >=
        BIRTHDAY_REWARD_MIN_ACCOUNT_AGE_DAYS
    );
}

export async function grantBirthdayReward({
    user,
    rewardDate,
    isLate,
}: {
    user: BirthdayRewardUser;
    rewardDate: Date;
    isLate: boolean;
}): Promise<BirthdayRewardResult> {
    const accounts = [...user.accounts].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const primaryAccount = accounts[0];
    if (!primaryAccount) {
        console.warn('Skipping birthday reward for user without account', {
            userId: user.id,
        });
        return { rewarded: false, reason: 'no_account' as const };
    }

    if (
        !isBirthdayRewardPrimaryAccountEligible({
            accountCreatedAt: primaryAccount.createdAt,
            rewardDate,
        })
    ) {
        return {
            rewarded: false,
            reason: 'account_too_new' as const,
            accountId: primaryAccount.accountId,
        };
    }

    const grantResult = await grantBirthdaySunflowers({
        accountId: primaryAccount.accountId,
        amount: BIRTHDAY_REWARD_AMOUNT,
        isLate,
        rewardDate,
        userId: user.id,
    });

    if (grantResult.status === 'existing') {
        return {
            rewarded: false,
            reason: 'already_rewarded' as const,
            accountId: primaryAccount.accountId,
        };
    }

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

    try {
        await createNotification({
            accountId: primaryAccount.accountId,
            userId: user.id,
            header,
            content,
            iconUrl: 'https://cdn.gredice.com/sunflower-large.svg',
            timestamp: new Date(),
        });
    } catch (error) {
        console.error('Failed to create birthday reward notification', {
            userId: user.id,
            accountId: primaryAccount.accountId,
            error,
        });
    }

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

    const daysDifference = differenceInCalendarDays(new Date(), rewardDate);
    return {
        rewarded: true,
        accountId: primaryAccount.accountId,
        daysLate: daysDifference,
    };
}
