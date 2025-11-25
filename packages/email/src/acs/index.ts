import {
    EmailClient,
    type EmailMessage,
    type EmailSendResponse,
    KnownEmailSendStatus,
} from '@azure/communication-email';
import type { OperationState } from '@azure/core-lro';
import {
    createEmailMessageLog,
    type EmailLogAttachment,
    type EmailLogRecipient,
    type EmailLogRecipients,
    type EmailStatus,
    updateEmailMessageLog,
} from '@gredice/storage';
import { render } from '@react-email/components';
import type { ReactElement } from 'react';

function emailClient() {
    const connectionString = process.env.ACS_CONNECTION_STRING;
    if (!connectionString) {
        throw new Error('ACS_CONNECTION_STRING is not set');
    }

    return new EmailClient(connectionString);
}

export type EmailRecipientInput =
    | string
    | EmailLogRecipient
    | Array<string | EmailLogRecipient>;

type NormalizedRecipientInput = string | EmailLogRecipient;

function normalizeRecipient(
    recipient: NormalizedRecipientInput,
): EmailLogRecipient | null {
    if (typeof recipient === 'string') {
        const trimmed = recipient.trim();
        if (!trimmed) {
            return null;
        }
        return { address: trimmed };
    }

    const address = recipient.address?.trim();
    if (!address) {
        return null;
    }

    const displayName = recipient.displayName?.trim();

    return displayName ? { address, displayName } : { address };
}

function normalizeRecipients(input?: EmailRecipientInput): EmailLogRecipient[] {
    if (!input) {
        return [];
    }

    const recipients = Array.isArray(input) ? input : [input];

    return recipients
        .map(normalizeRecipient)
        .filter((recipient): recipient is EmailLogRecipient =>
            Boolean(recipient),
        );
}

function toAzureRecipients(recipients: EmailLogRecipient[]) {
    return recipients.map((recipient) =>
        recipient.displayName
            ? {
                  address: recipient.address,
                  displayName: recipient.displayName,
              }
            : { address: recipient.address },
    );
}

function toLogRecipients({
    to,
    cc,
    bcc,
    replyTo,
}: {
    to: EmailLogRecipient[];
    cc: EmailLogRecipient[];
    bcc: EmailLogRecipient[];
    replyTo: EmailLogRecipient[];
}): EmailLogRecipients {
    const recipients: EmailLogRecipients = {
        to,
    };

    if (cc.length > 0) {
        recipients.cc = cc;
    }
    if (bcc.length > 0) {
        recipients.bcc = bcc;
    }
    if (replyTo.length > 0) {
        recipients.replyTo = replyTo;
    }

    return recipients;
}

function mapProviderStatus(status?: string): EmailStatus {
    switch (status) {
        case KnownEmailSendStatus.Succeeded:
            return 'sent';
        case KnownEmailSendStatus.Running:
            return 'sending';
        case KnownEmailSendStatus.NotStarted:
            return 'queued';
        case KnownEmailSendStatus.Canceled:
        case KnownEmailSendStatus.Failed:
            return 'failed';
        default:
            return 'failed';
    }
}

function buildAttachmentMetadata(
    attachments?: EmailSendAttachment[],
): EmailLogAttachment[] {
    if (!attachments) {
        return [];
    }

    return attachments.map(({ name, contentType, content }) => ({
        name,
        contentType,
        size:
            typeof content === 'string'
                ? Buffer.byteLength(content)
                : content.byteLength,
    }));
}

function getOperationStateId(
    state: OperationState<EmailSendResponse>,
): string | null {
    if ('id' in state) {
        const id = state.id;
        if (typeof id === 'string') {
            return id;
        }
    }

    return null;
}

export type EmailSendAttachment = {
    name: string;
    contentType: string;
    content: ArrayBuffer | string;
};

export type SendEmailParams = {
    from: string;
    to: EmailRecipientInput;
    subject: string;
    template: ReactElement;
    cc?: EmailRecipientInput;
    bcc?: EmailRecipientInput;
    replyTo?: EmailRecipientInput;
    attachments?: EmailSendAttachment[];
    templateName?: string | null;
    messageType?: string | null;
    metadata?: Record<string, unknown>;
};

export async function sendEmail({
    from,
    to,
    cc,
    bcc,
    replyTo,
    subject,
    template,
    attachments,
    templateName,
    messageType,
    metadata,
}: SendEmailParams) {
    const toRecipients = normalizeRecipients(to);
    if (toRecipients.length === 0) {
        throw new Error(
            'At least one recipient must be provided in the "to" field',
        );
    }

    const ccRecipients = normalizeRecipients(cc);
    const bccRecipients = normalizeRecipients(bcc);
    const replyToRecipients = normalizeRecipients(replyTo);

    const emailHtml = await render(template);
    const emailPlaintext = await render(template, { plainText: true });

    const emailLog = await createEmailMessageLog({
        fromAddress: from,
        subject,
        templateName: templateName ?? null,
        messageType: messageType ?? null,
        recipients: toLogRecipients({
            to: toRecipients,
            cc: ccRecipients,
            bcc: bccRecipients,
            replyTo: replyToRecipients,
        }),
        attachments: buildAttachmentMetadata(attachments),
        metadata: metadata ?? {},
        htmlBody: emailHtml,
        textBody: emailPlaintext,
        status: 'queued',
    });

    const client = emailClient();

    const azureMessage: EmailMessage = {
        senderAddress: from,
        recipients: {
            to: toAzureRecipients(toRecipients),
            cc:
                ccRecipients.length > 0
                    ? toAzureRecipients(ccRecipients)
                    : undefined,
            bcc:
                bccRecipients.length > 0
                    ? toAzureRecipients(bccRecipients)
                    : undefined,
        },
        content: {
            subject,
            html: emailHtml,
            plainText: emailPlaintext,
        },
        attachments: attachments?.map(({ name, contentType, content }) => ({
            name,
            contentType,
            contentInBase64:
                typeof content === 'string'
                    ? content
                    : Buffer.from(content).toString('base64'),
        })),
    };

    if (replyToRecipients.length > 0) {
        azureMessage.replyTo = toAzureRecipients(replyToRecipients);
    }

    try {
        const poller = await client.beginSend(azureMessage);
        const operationState = poller.getOperationState();
        const operationStateId = getOperationStateId(operationState);

        await updateEmailMessageLog(emailLog.id, {
            status: 'sending',
            providerMessageId: operationStateId,
            providerStatus: operationState.status ?? null,
            lastAttemptAt: new Date(),
        });

        const response = await poller.pollUntilDone();
        const finalStatus = mapProviderStatus(response.status);

        await updateEmailMessageLog(emailLog.id, {
            status: finalStatus,
            providerStatus: response.status,
            providerMessageId: response.id ?? operationStateId ?? null,
            sentAt: finalStatus === 'sent' ? new Date() : null,
            completedAt: new Date(),
            errorCode: response.error?.code ?? null,
            errorMessage: response.error?.message ?? null,
        });

        if (response.status !== KnownEmailSendStatus.Succeeded) {
            throw new Error(response.error?.message ?? 'Failed to send email');
        }

        return response;
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : 'Failed to send email';
        await updateEmailMessageLog(emailLog.id, {
            status: 'failed',
            errorMessage,
            completedAt: new Date(),
        });
        throw error;
    }
}
