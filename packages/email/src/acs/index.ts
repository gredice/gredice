import {
    EmailClient,
    type EmailClientOptions,
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
import type { ReactElement } from 'react';
import { render } from 'react-email';

export function createAtMostOnceEmailClient(
    connectionString: string,
    options: EmailClientOptions = {},
) {
    return new EmailClient(connectionString, {
        ...options,
        retryOptions: {
            ...options.retryOptions,
            maxRetries: 0,
        },
    });
}

function emailClient(atMostOnce: boolean) {
    const connectionString = process.env.ACS_CONNECTION_STRING;
    if (!connectionString) {
        throw new Error('ACS_CONNECTION_STRING is not set');
    }

    return atMostOnce
        ? createAtMostOnceEmailClient(connectionString)
        : new EmailClient(connectionString);
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
    operationId?: string;
};

const providerOperationIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class EmailProviderSubmissionUncertainError extends Error {
    readonly code = 'email_provider_submission_uncertain';
    readonly operationId: string;

    constructor(operationId: string, cause: unknown) {
        super('Email provider submission status is uncertain.', { cause });
        this.name = 'EmailProviderSubmissionUncertainError';
        this.operationId = operationId;
    }
}

const retryableEmailProviderRejectionStatuses = new Set([429]);

type EmailProviderSubmissionFailureClassification =
    | { kind: 'definite-failure' }
    | { kind: 'rejected'; retryable: boolean; statusCode: number }
    | { kind: 'uncertain' };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedProviderRejectionStatus(value: unknown) {
    return typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= 400 &&
        value <= 599
        ? value
        : null;
}

function explicitProviderResponseStatus(error: unknown) {
    if (!isRecord(error)) return null;
    return (
        (isRecord(error.response)
            ? boundedProviderRejectionStatus(error.response.status)
            : null) ?? boundedProviderRejectionStatus(error.statusCode)
    );
}

function providerRejectionIsRetryable(statusCode: number) {
    return retryableEmailProviderRejectionStatuses.has(statusCode);
}

function providerResponseProvesRejection(statusCode: number) {
    return statusCode >= 400 && statusCode < 500 && statusCode !== 408;
}

export class EmailProviderSubmissionRejectedError extends Error {
    readonly code = 'email_provider_submission_rejected';
    readonly retryable: boolean;
    readonly statusCode: number;

    constructor(statusCode: number, cause?: unknown) {
        const boundedStatusCode = boundedProviderRejectionStatus(statusCode);
        if (boundedStatusCode === null) {
            throw new Error(
                'Email provider rejection requires a bounded HTTP status.',
            );
        }
        super(
            `Email provider rejected submission with HTTP status ${boundedStatusCode}.`,
            cause === undefined ? undefined : { cause },
        );
        this.name = 'EmailProviderSubmissionRejectedError';
        this.retryable = providerRejectionIsRetryable(boundedStatusCode);
        this.statusCode = boundedStatusCode;
    }
}

export function isEmailProviderSubmissionUncertainError(
    error: unknown,
): error is EmailProviderSubmissionUncertainError {
    return (
        error instanceof EmailProviderSubmissionUncertainError ||
        (typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'email_provider_submission_uncertain')
    );
}

export function isEmailProviderSubmissionRejectedError(
    error: unknown,
): error is EmailProviderSubmissionRejectedError {
    if (error instanceof EmailProviderSubmissionRejectedError) return true;
    if (
        !isRecord(error) ||
        error.code !== 'email_provider_submission_rejected'
    ) {
        return false;
    }
    const statusCode = boundedProviderRejectionStatus(error.statusCode);
    return (
        statusCode !== null &&
        typeof error.retryable === 'boolean' &&
        error.retryable === providerRejectionIsRetryable(statusCode)
    );
}

export function classifyEmailProviderSubmissionFailure({
    error,
    operationId,
    providerSubmissionAccepted = false,
    providerSubmissionStarted,
    terminalProviderStatus,
}: {
    error: unknown;
    operationId?: string;
    providerSubmissionAccepted?: boolean;
    providerSubmissionStarted: boolean;
    terminalProviderStatus?: string;
}): EmailProviderSubmissionFailureClassification {
    if (
        terminalProviderStatus === KnownEmailSendStatus.Failed ||
        terminalProviderStatus === KnownEmailSendStatus.Canceled
    ) {
        return { kind: 'definite-failure' };
    }
    if (providerSubmissionStarted && !providerSubmissionAccepted) {
        const statusCode = explicitProviderResponseStatus(error);
        if (
            statusCode !== null &&
            providerResponseProvesRejection(statusCode)
        ) {
            return {
                kind: 'rejected',
                retryable: providerRejectionIsRetryable(statusCode),
                statusCode,
            };
        }
    }
    return providerSubmissionStarted && operationId !== undefined
        ? { kind: 'uncertain' }
        : { kind: 'definite-failure' };
}

export function emailProviderSubmissionIsUncertain({
    error,
    operationId,
    providerSubmissionAccepted,
    providerSubmissionStarted,
    terminalProviderStatus,
}: {
    error?: unknown;
    operationId?: string;
    providerSubmissionAccepted?: boolean;
    providerSubmissionStarted: boolean;
    terminalProviderStatus?: string;
}) {
    return (
        classifyEmailProviderSubmissionFailure({
            error,
            operationId,
            providerSubmissionAccepted,
            providerSubmissionStarted,
            terminalProviderStatus,
        }).kind === 'uncertain'
    );
}

export function assertEmailProviderSendSucceeded(
    response: Pick<EmailSendResponse, 'error' | 'status'>,
) {
    if (response.status !== KnownEmailSendStatus.Succeeded) {
        throw new Error(response.error?.message ?? 'Failed to send email');
    }
}

function normalizedProviderOperationId(value?: string) {
    if (value === undefined) return undefined;
    const normalized = value.trim().toLowerCase();
    if (!providerOperationIdPattern.test(normalized)) {
        throw new Error(
            'Email provider operation ID must be a canonical UUID.',
        );
    }
    return normalized;
}

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
    operationId,
}: SendEmailParams) {
    const providerOperationId = normalizedProviderOperationId(operationId);
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
        providerMessageId: providerOperationId ?? null,
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

    const client = emailClient(providerOperationId !== undefined);

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

    let providerSubmissionAccepted = false;
    let providerSubmissionStarted = false;
    let terminalProviderStatus: string | undefined;
    try {
        // ACS Operation-Id identifies the long-running operation, but it is not
        // a repeatability guarantee. Disable the SDK's internal POST retries for
        // this durable at-most-once path, and fence any response that does not
        // prove the provider rejected the submission.
        providerSubmissionStarted = true;
        const poller = await client.beginSend(
            azureMessage,
            providerOperationId
                ? { operationId: providerOperationId }
                : undefined,
        );
        providerSubmissionAccepted = true;
        const operationState = poller.getOperationState();
        const operationStateId = getOperationStateId(operationState);

        await updateEmailMessageLog(emailLog.id, {
            status: 'sending',
            providerMessageId: operationStateId ?? providerOperationId ?? null,
            providerStatus: operationState.status ?? null,
            lastAttemptAt: new Date(),
        });

        const response = await poller.pollUntilDone();
        terminalProviderStatus = response.status;
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

        assertEmailProviderSendSucceeded(response);

        return response;
    } catch (error) {
        const failure = classifyEmailProviderSubmissionFailure({
            error,
            operationId: providerOperationId,
            providerSubmissionAccepted,
            providerSubmissionStarted,
            terminalProviderStatus,
        });
        const submissionIsUncertain = failure.kind === 'uncertain';
        const errorMessage = submissionIsUncertain
            ? 'Email provider submission status is uncertain.'
            : failure.kind === 'rejected'
              ? `Email provider rejected submission with HTTP status ${failure.statusCode}.`
              : error instanceof Error
                ? error.message
                : 'Failed to send email';
        try {
            await updateEmailMessageLog(emailLog.id, {
                status: submissionIsUncertain ? 'sending' : 'failed',
                errorMessage,
                completedAt: submissionIsUncertain ? null : new Date(),
            });
        } catch {
            // Preserve the provider result classification when audit-log storage
            // is unavailable after the provider boundary.
        }
        if (submissionIsUncertain && providerOperationId) {
            throw new EmailProviderSubmissionUncertainError(
                providerOperationId,
                error,
            );
        }
        if (failure.kind === 'rejected') {
            throw new EmailProviderSubmissionRejectedError(
                failure.statusCode,
                error,
            );
        }
        throw error;
    }
}
