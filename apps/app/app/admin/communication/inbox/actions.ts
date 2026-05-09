'use server';

import { sendEmail } from '@gredice/email/acs';
import MarkdownEmailTemplate from '@gredice/transactional/emails/markdown';
import { auth } from '../../../../lib/auth/auth';

export async function submitEmailForm(
    attachments: File[],
    _prevState: unknown,
    formData: FormData,
) {
    const { user } = await auth(['admin']);
    const userName = user.userName;

    const predefinedFrom = userName;

    const to = formData.get('to') as string;
    const subject = formData.get('subject') as string;
    const message = formData.get('message') as string;
    const emailAttachments = await Promise.all(
        attachments.map(async (file) => {
            return {
                name: file.name,
                contentType: file.type,
                content: await file.arrayBuffer(),
            };
        }),
    );

    await sendEmail({
        from: predefinedFrom,
        to,
        subject,
        template: MarkdownEmailTemplate({
            content: message,
            previewText: subject,
        }),
        attachments: emailAttachments,
        templateName: 'admin-markdown',
        messageType: 'admin-manual',
        metadata: {
            form: 'communication-inbox',
        },
    });

    return {
        success: true,
    };
}
