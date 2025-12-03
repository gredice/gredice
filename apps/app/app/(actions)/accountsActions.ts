'use server';

import { sendEmail } from '@gredice/email/acs';
import { getAccountUsers } from '@gredice/storage';
import AccountDeleteConfirmationTemplate from '@gredice/transactional/emails/Account/delete-confirmation';
import { createJwt } from '../../lib/auth/auth';

export async function sendDeleteAccountEmail(accountId: string) {
    // Only allow if account has one user
    const users = await getAccountUsers(accountId);
    if (!users || users.length !== 1) {
        throw new Error('Account must have exactly one user.');
    }

    // Get user email
    const user = users[0].user;
    const email = user.userName;
    if (!email) {
        throw new Error('User email not found.');
    }
    // TODO: Validate username is valid email

    const token = await createJwt(user.id, '72h');
    const confirmLink = `https://vrt.gredice.com/racun/brisanje?token=${token}`;
    await sendEmail({
        from: 'suncokret@obavijesti.gredice.com',
        to: email,
        subject: 'Gredice - potvrda brisanja računa',
        template: AccountDeleteConfirmationTemplate({
            confirmLink,
            email,
        }),
        templateName: 'account-delete-confirmation',
        messageType: 'account',
        metadata: {
            accountId,
        },
    });
}
