'use server';

import { render } from '@react-email/components';
import { EmailClient, EmailMessage, KnownEmailSendStatus } from '@azure/communication-email';
import { ReactElement } from 'react';
import MarkdownEmailTemplate from '@gredice/transactional/emails/markdown';
import { auth } from '../../../../lib/auth/auth';

function emailClient() {
    const connectionString = process.env.ACS_CONNECTION_STRING;
    if (!connectionString)
        throw new Error('ACS_CONNECTION_STRING is not set');

    return new EmailClient(connectionString);
}

async function sendEmail({
    from, to, subject, template, attachments
}: {
    from: string,
    to: string;
    subject: string;
    template: ReactElement;
    attachments?: { name: string, contentType: string, content: ArrayBuffer | string }[];
}) {
    const emailHtml = await render(template);
    const emailPlaintext = await render(template, { plainText: true });

    const email: EmailMessage = {
        senderAddress: from,
        recipients: {
            to: [{ address: to }]
        },
        content: {
            subject,
            html: emailHtml,
            plainText: emailPlaintext
        },
        attachments: attachments?.map(({ name, contentType, content }) => ({
            name,
            contentType,
            contentInBase64: typeof content === 'string' ? content : Buffer.from(content).toString('base64')
        })) || []
    };

    // TODO: Save email to email queue with priority (get priority from props)

    const client = emailClient();
    const poller = await client.beginSend(email);
    const response = await poller.pollUntilDone();
    if (response.status !== KnownEmailSendStatus.Succeeded)
        throw new Error('Failed to send email');
}

export async function submitEmailForm(attachments: File[], _prevState: unknown, formData: FormData) {
    const { user } = await auth(['admin']);
    const userName = user.userName;

    const predefinedFrom = userName;

    const to = formData.get('to') as string;
    const subject = formData.get('subject') as string;
    const message = formData.get('message') as string;
    const emailAttachments = await Promise.all(attachments
        .map(async (file) => {
            return ({
                name: file.name,
                contentType: file.type,
                content: await file.arrayBuffer()
            });
        }));

    await sendEmail({
        from: predefinedFrom,
        to,
        subject,
        template: MarkdownEmailTemplate({
            content: message,
            previewText: subject
        }),
        attachments: emailAttachments
    });

    return {
        success: true
    };
}