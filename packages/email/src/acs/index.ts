import { ReactElement } from "react";
import { render } from '@react-email/components';
import { EmailClient, EmailMessage, KnownEmailSendStatus } from '@azure/communication-email';

function emailClient() {
    const connectionString = process.env.ACS_CONNECTION_STRING;
    if (!connectionString)
        throw new Error('ACS_CONNECTION_STRING is not set');

    return new EmailClient(connectionString);
}

export async function sendEmail({
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