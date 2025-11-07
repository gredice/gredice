import 'server-only';

import { desc, eq } from 'drizzle-orm';
import { storage } from '..';
import {
    type EmailLogAttachment,
    type EmailLogRecipients,
    type EmailStatus,
    emailMessages,
    type InsertEmailMessage,
    type SelectEmailMessage,
} from '../schema';

function stripUndefined<T extends Record<string, unknown>>(values: T) {
    return Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== undefined),
    ) as T;
}

export type CreateEmailMessageLog = {
    provider?: string;
    providerMessageId?: string | null;
    providerStatus?: string | null;
    fromAddress: string;
    subject: string;
    templateName?: string | null;
    messageType?: string | null;
    recipients: EmailLogRecipients;
    attachments?: EmailLogAttachment[];
    metadata?: Record<string, unknown>;
    htmlBody?: string | null;
    textBody?: string | null;
    status?: EmailStatus;
    queuedAt?: Date;
};

export async function createEmailMessageLog(
    message: CreateEmailMessageLog,
): Promise<SelectEmailMessage> {
    const [created] = await storage()
        .insert(emailMessages)
        .values({
            provider: message.provider ?? 'acs',
            providerMessageId: message.providerMessageId ?? null,
            providerStatus: message.providerStatus ?? null,
            fromAddress: message.fromAddress,
            subject: message.subject,
            templateName: message.templateName ?? null,
            messageType: message.messageType ?? null,
            recipients: message.recipients,
            attachments: message.attachments ?? [],
            metadata: message.metadata ?? {},
            htmlBody: message.htmlBody ?? null,
            textBody: message.textBody ?? null,
            status: message.status ?? 'queued',
            queuedAt: message.queuedAt ?? new Date(),
        })
        .returning();

    if (!created) {
        throw new Error('Failed to create email log entry');
    }

    return created;
}

export type UpdateEmailMessageLog = Partial<
    Omit<InsertEmailMessage, 'id' | 'fromAddress' | 'subject' | 'recipients'>
>;

export async function updateEmailMessageLog(
    id: number,
    update: UpdateEmailMessageLog,
): Promise<SelectEmailMessage | null> {
    const cleaned = stripUndefined({
        ...update,
        updatedAt: new Date(),
    });

    if (Object.keys(cleaned).length === 0) {
        const current = await getEmailMessage(id);
        return current ?? null;
    }

    const [updated] = await storage()
        .update(emailMessages)
        .set(cleaned)
        .where(eq(emailMessages.id, id))
        .returning();

    return updated ?? null;
}

export function getEmailMessages({
    limit = 100,
    offset = 0,
    status,
}: {
    limit?: number;
    offset?: number;
    status?: EmailStatus;
} = {}): Promise<SelectEmailMessage[]> {
    return storage().query.emailMessages.findMany({
        where: status ? eq(emailMessages.status, status) : undefined,
        orderBy: desc(emailMessages.createdAt),
        limit,
        offset,
    });
}

export function getEmailMessage(
    id: number,
): Promise<SelectEmailMessage | undefined> {
    return storage().query.emailMessages.findFirst({
        where: eq(emailMessages.id, id),
    });
}

export function getEmailMessageByProviderId(
    providerMessageId: string,
): Promise<SelectEmailMessage | undefined> {
    return storage().query.emailMessages.findFirst({
        where: eq(emailMessages.providerMessageId, providerMessageId),
    });
}
