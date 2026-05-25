'use server';

import {
    clearUsedReferralCodeForAccount,
    ReferralCodeAlreadyExistsError,
    ReferralCodeInvalidError,
    ReferralCodeReservedError,
    setReferralCodeForAccount,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

export type AccountReferralActionState =
    | { success: true; message: string }
    | { success: false; message: string }
    | null;

export async function setAccountReferralCodeAction(
    _prevState: AccountReferralActionState,
    formData: FormData,
): Promise<AccountReferralActionState> {
    await auth(['admin']);

    const accountIdValue = formData.get('accountId');
    const codeValue = formData.get('code');
    if (typeof accountIdValue !== 'string' || typeof codeValue !== 'string') {
        return {
            success: false,
            message: 'Nevažeći podaci za kod preporuke.',
        };
    }

    const accountId = accountIdValue.trim();
    if (!accountId) {
        return {
            success: false,
            message: 'Račun nije pronađen.',
        };
    }

    try {
        const code = await setReferralCodeForAccount(accountId, codeValue, {
            source: 'admin',
        });
        revalidatePath(KnownPages.Account(accountId));
        return {
            success: true,
            message: `Kod preporuke je postavljen na ${code}.`,
        };
    } catch (error) {
        if (error instanceof ReferralCodeInvalidError) {
            return {
                success: false,
                message: 'Unesite ispravan kod preporuke.',
            };
        }
        if (error instanceof ReferralCodeAlreadyExistsError) {
            return {
                success: false,
                message: 'Kod preporuke je već zauzet.',
            };
        }
        if (error instanceof ReferralCodeReservedError) {
            return {
                success: false,
                message: 'Kod preporuke ne može biti dio ID-a računa.',
            };
        }

        console.error('Failed to set account referral code', {
            accountId,
            error,
        });
        return {
            success: false,
            message: 'Greška pri spremanju koda preporuke.',
        };
    }
}

export async function clearAccountUsedReferralCodeAction(
    _prevState: AccountReferralActionState,
    formData: FormData,
): Promise<AccountReferralActionState> {
    await auth(['admin']);

    const accountIdValue = formData.get('accountId');
    if (typeof accountIdValue !== 'string') {
        return {
            success: false,
            message: 'Nevažeći račun.',
        };
    }

    const accountId = accountIdValue.trim();
    if (!accountId) {
        return {
            success: false,
            message: 'Račun nije pronađen.',
        };
    }

    try {
        const clearedReferral = await clearUsedReferralCodeForAccount(
            accountId,
            { source: 'admin' },
        );
        if (!clearedReferral) {
            return {
                success: false,
                message: 'Račun nema dodijeljen kod preporučitelja.',
            };
        }

        revalidatePath(KnownPages.Account(accountId));
        return {
            success: true,
            message: 'Dodijeljeni kod preporučitelja je očišćen.',
        };
    } catch (error) {
        console.error('Failed to clear account used referral code', {
            accountId,
            error,
        });
        return {
            success: false,
            message: 'Greška pri čišćenju koda preporučitelja.',
        };
    }
}
