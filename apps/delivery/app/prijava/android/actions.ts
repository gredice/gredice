'use server';

import {
    createDeliveryNativeAuthorizationGrant,
    DeliveryNativeAuthError,
    getEligibleDeliveryNativeAccounts,
} from '@gredice/storage';
import { redirect } from 'next/navigation';
import { auth } from '../../../lib/auth/auth';
import {
    deliveryNativeCallbackUrl,
    parseDeliveryNativeAuthorizationRequest,
} from '../../../lib/deliveryNativeAuthorization';

export async function authorizeDeliveryNativeAction(
    _previousState: string | null,
    formData: FormData,
) {
    const request = parseDeliveryNativeAuthorizationRequest({
        client_id: formData.get('client_id')?.toString(),
        redirect_uri: formData.get('redirect_uri')?.toString(),
        code_challenge: formData.get('code_challenge')?.toString(),
        code_challenge_method: formData
            .get('code_challenge_method')
            ?.toString(),
        state: formData.get('state')?.toString(),
    });
    if (!request)
        return 'Zahtjev aplikacije nije valjan. Pokrenite povezivanje ponovno.';

    let session: Awaited<ReturnType<typeof auth>>;
    try {
        session = await auth(['driver', 'admin']);
    } catch {
        return 'Za povezivanje je potrebna prijava dostavljača ili administratora.';
    }

    const accounts = await getEligibleDeliveryNativeAccounts(session.userId);
    if (accounts.length === 0) {
        return 'Nijedan račun nije dostupan za dostavu.';
    }

    const requestedAccountId = formData.get('account_id')?.toString();
    const selectedAccountId =
        accounts.length === 1
            ? accounts[0]?.id
            : accounts.some((account) => account.id === requestedAccountId)
              ? requestedAccountId
              : null;
    if (!selectedAccountId) {
        return 'Odaberite račun koji želite povezati.';
    }

    try {
        const authorization = await createDeliveryNativeAuthorizationGrant({
            userId: session.userId,
            accountId: selectedAccountId,
            clientId: request.clientId,
            redirectUri: request.redirectUri,
            codeChallenge: request.codeChallenge,
        });
        redirect(
            deliveryNativeCallbackUrl({
                code: authorization.code,
                state: request.state,
            }),
        );
    } catch (error) {
        if (error instanceof DeliveryNativeAuthError) {
            return error.code === 'DELIVERY_ROLE_REQUIRED'
                ? 'Za povezivanje je potrebna uloga dostavljača.'
                : 'Odabrani račun više nije dostupan.';
        }
        throw error;
    }
}
