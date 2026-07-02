import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
    accounts,
    accountUsers,
    type SelectSurvey,
    type SelectSurveyAssignment,
    type SelectSurveyQuestion,
    type SelectSurveyResponse,
    type SelectSurveySend,
    type SelectSurveyVersion,
    type SurveyAssignmentContext,
    type SurveyContactAnswer,
    type SurveyQuestionScoreMetadata,
    type SurveyQuestionSettings,
    type SurveySendAudience,
    type SurveySendChannelPolicy,
    surveyAnswers,
    surveyAssignments,
    surveyQuestions,
    surveyResponses,
    surveySendDeliveries,
    surveySends,
    surveys,
    surveyVersions,
    users,
} from '../schema';
import { storage } from '../storage';

export const DELIVERY_SATISFACTION_SURVEY_KEY = 'delivery_satisfaction';
export const DELIVERY_SATISFACTION_TYPEFORM_ID = 'X727vyBk';
export const DELIVERY_SATISFACTION_TYPEFORM_URL =
    'https://form.typeform.com/to/X727vyBk';

export type SurveyQuestionType = SelectSurveyQuestion['type'];
export type SurveyAssignmentStatus = SelectSurveyAssignment['status'];
export type SurveySendDeliveryChannel =
    (typeof surveySendDeliveries.$inferSelect)['channel'];
export type SurveySendDeliveryStatus =
    (typeof surveySendDeliveries.$inferSelect)['status'];

export type SurveyQuestionInput = {
    key: string;
    title: string;
    description?: string | null;
    type: SurveyQuestionType;
    required?: boolean;
    settings: SurveyQuestionSettings;
    scoreMetadata?: SurveyQuestionScoreMetadata;
};

export type SurveyDefinitionInput = {
    key: string;
    title: string;
    description?: string | null;
    category?: string;
    introTitle?: string | null;
    introDescription?: string | null;
    thankYouTitle?: string | null;
    thankYouDescription?: string | null;
    metadata?: Record<string, unknown>;
    createdByUserId?: string | null;
    questions: SurveyQuestionInput[];
};

export type SurveyRecipient = {
    accountId: string;
    userId?: string | null;
};

export type SurveyAudiencePreview = {
    audienceType: SurveySendAudience['type'];
    targetCount: number;
    accountCount: number;
    userCount: number;
    explicitRecipientCount: number;
    unmatchedRecipientCount: number;
    recipients: SurveyRecipient[];
};

export type SurveyAssignmentSummary = {
    assignment: SelectSurveyAssignment;
    duplicate: boolean;
};

export type SurveyAssignmentResult = {
    assignments: SurveyAssignmentSummary[];
    createdCount: number;
    skippedDuplicateCount: number;
};

export type SurveySendResult = SurveyAssignmentResult & {
    send: SelectSurveySend;
    preview: SurveyAudiencePreview;
};

export type SurveyRuntimeQuestion = SelectSurveyQuestion;

export type SurveyRuntimeAssignment = {
    assignment: SelectSurveyAssignment;
    survey: SelectSurvey;
    version: SelectSurveyVersion;
    questions: SurveyRuntimeQuestion[];
    response: SelectSurveyResponse | null;
};

export type SurveyAnswerInput = {
    questionId?: string;
    questionKey?: string;
    value?: unknown;
};

export type SurveySubmitResult =
    | {
          ok: true;
          responseId: string;
      }
    | {
          ok: false;
          status:
              | 'not_found'
              | 'unauthorized'
              | 'expired'
              | 'already_submitted'
              | 'invalid';
          message: string;
          fieldErrors?: Record<string, string>;
      };

export type SurveyNumericAggregate = {
    questionId: string;
    questionKey: string;
    title: string;
    count: number;
    unansweredCount: number;
    average: number | null;
    median: number | null;
    distribution: Record<string, number>;
    scoreMetadata: SurveyQuestionScoreMetadata;
};

export type SurveyResponseDetail = {
    response: SelectSurveyResponse;
    assignment: SelectSurveyAssignment | null;
    answers: Array<typeof surveyAnswers.$inferSelect>;
};

export type SurveyResults = {
    survey: SelectSurvey;
    versions: SelectSurveyVersion[];
    questions: SelectSurveyQuestion[];
    responses: SurveyResponseDetail[];
    numericAggregates: SurveyNumericAggregate[];
};

type SurveyMembershipRow = {
    accountId: string;
    userId: string;
};

function uniqueStrings(values: string[]) {
    return Array.from(new Set(values));
}

function normalizeText(value: string, label: string) {
    const normalized = value.trim();
    if (!normalized) {
        throw new Error(`${label} is required`);
    }
    return normalized;
}

function targetKey(recipient: SurveyRecipient) {
    const accountId = normalizeText(recipient.accountId, 'accountId');
    const userId = recipient.userId?.trim() || null;
    return userId
        ? `account:${accountId}:user:${userId}`
        : `account:${accountId}`;
}

function recipientMembershipKey(row: SurveyRecipient) {
    return `${row.accountId}:${row.userId ?? ''}`;
}

function normalizeRecipients(recipients: SurveyRecipient[]) {
    const normalized = new Map<string, SurveyRecipient>();
    for (const recipient of recipients) {
        const accountId = recipient.accountId.trim();
        const userId = recipient.userId?.trim() || null;
        if (!accountId) continue;
        normalized.set(recipientMembershipKey({ accountId, userId }), {
            accountId,
            userId,
        });
    }
    return Array.from(normalized.values());
}

function normalizeAudience(audience: SurveySendAudience): SurveySendAudience {
    switch (audience.type) {
        case 'accounts':
            return {
                type: 'accounts',
                accountIds: uniqueStrings(
                    audience.accountIds.map((id) => id.trim()).filter(Boolean),
                ),
            };
        case 'users':
            return {
                type: 'users',
                userIds: uniqueStrings(
                    audience.userIds.map((id) => id.trim()).filter(Boolean),
                ),
                accountIds: audience.accountIds
                    ? uniqueStrings(
                          audience.accountIds
                              .map((id) => id.trim())
                              .filter(Boolean),
                      )
                    : undefined,
            };
        case 'explicit':
            return {
                type: 'explicit',
                recipients: normalizeRecipients(audience.recipients),
            };
    }
}

function validateQuestionSettings(
    type: SurveyQuestionType,
    settings: SurveyQuestionSettings,
) {
    if (settings.type !== type) {
        throw new Error(`Question settings type must match ${type}`);
    }

    if (type === 'opinion_scale') {
        if (settings.type !== 'opinion_scale') {
            throw new Error('Opinion scale settings are required');
        }
        if (
            !Number.isInteger(settings.min) ||
            !Number.isInteger(settings.max) ||
            settings.min < 0 ||
            settings.max > 10 ||
            settings.min >= settings.max
        ) {
            throw new Error(
                'Opinion scale bounds must be integers from 0 to 10',
            );
        }
    }

    if (type === 'long_text') {
        if (settings.type !== 'long_text') {
            throw new Error('Long text settings are required');
        }
        if (
            settings.maxLength !== undefined &&
            (!Number.isInteger(settings.maxLength) || settings.maxLength < 1)
        ) {
            throw new Error('Long text maxLength must be a positive integer');
        }
    }

    if (type === 'contact_info') {
        if (settings.type !== 'contact_info') {
            throw new Error('Contact info settings are required');
        }
        if (settings.fields.length === 0) {
            throw new Error(
                'Contact info questions require at least one field',
            );
        }
    }
}

function validateQuestions(questions: SurveyQuestionInput[]) {
    if (questions.length === 0) {
        throw new Error('Survey requires at least one question');
    }

    const keys = new Set<string>();
    return questions.map((question, index) => {
        const key = normalizeText(question.key, 'question key');
        if (keys.has(key)) {
            throw new Error(`Duplicate question key: ${key}`);
        }
        keys.add(key);
        validateQuestionSettings(question.type, question.settings);
        return {
            ...question,
            key,
            title: normalizeText(question.title, 'question title'),
            description: question.description?.trim() || null,
            sortOrder: index + 1,
            required: question.required ?? false,
            scoreMetadata: question.scoreMetadata ?? {},
        };
    });
}

export async function createSurveyDefinition(input: SurveyDefinitionInput) {
    const normalizedQuestions = validateQuestions(input.questions);
    const surveyId = randomUUID();
    const versionId = randomUUID();
    const now = new Date();

    await storage().transaction(async (tx) => {
        await tx.insert(surveys).values({
            id: surveyId,
            key: normalizeText(input.key, 'survey key'),
            title: normalizeText(input.title, 'survey title'),
            description: input.description?.trim() || null,
            category: input.category?.trim() || 'general',
            status: 'draft',
            metadata: input.metadata ?? {},
            createdByUserId: input.createdByUserId ?? null,
            createdAt: now,
            updatedAt: now,
        });
        await tx.insert(surveyVersions).values({
            id: versionId,
            surveyId,
            versionNumber: 1,
            status: 'draft',
            title: normalizeText(input.title, 'survey title'),
            description: input.description?.trim() || null,
            introTitle: input.introTitle?.trim() || null,
            introDescription: input.introDescription?.trim() || null,
            thankYouTitle: input.thankYouTitle?.trim() || null,
            thankYouDescription: input.thankYouDescription?.trim() || null,
            metadata: input.metadata ?? {},
            createdAt: now,
            updatedAt: now,
        });
        await tx.insert(surveyQuestions).values(
            normalizedQuestions.map((question) => ({
                id: randomUUID(),
                versionId,
                key: question.key,
                type: question.type,
                title: question.title,
                description: question.description,
                sortOrder: question.sortOrder,
                required: question.required,
                settings: question.settings,
                scoreMetadata: question.scoreMetadata,
                createdAt: now,
            })),
        );
    });

    return { surveyId, versionId };
}

export async function getSurveyByKey(key: string) {
    return await storage().query.surveys.findFirst({
        where: eq(surveys.key, key),
    });
}

export async function getSurveyById(id: string) {
    return await storage().query.surveys.findFirst({
        where: eq(surveys.id, id),
    });
}

export async function getSurveyVersion(versionId: string) {
    return await storage().query.surveyVersions.findFirst({
        where: eq(surveyVersions.id, versionId),
    });
}

export async function getSurveyQuestions(versionId: string) {
    return await storage().query.surveyQuestions.findMany({
        where: eq(surveyQuestions.versionId, versionId),
        orderBy: asc(surveyQuestions.sortOrder),
    });
}

async function getLatestVersionNumber(surveyId: string) {
    const row = await storage()
        .select({
            versionNumber: surveyVersions.versionNumber,
        })
        .from(surveyVersions)
        .where(eq(surveyVersions.surveyId, surveyId))
        .orderBy(desc(surveyVersions.versionNumber))
        .limit(1);
    return row[0]?.versionNumber ?? 0;
}

export async function createSurveyDraftVersion(
    surveyId: string,
    input: Omit<SurveyDefinitionInput, 'key' | 'category' | 'createdByUserId'>,
) {
    const survey = await getSurveyById(surveyId);
    if (!survey) {
        throw new Error('Survey not found');
    }

    const normalizedQuestions = validateQuestions(input.questions);
    const versionId = randomUUID();
    const now = new Date();
    const versionNumber = (await getLatestVersionNumber(surveyId)) + 1;

    await storage().transaction(async (tx) => {
        await tx.insert(surveyVersions).values({
            id: versionId,
            surveyId,
            versionNumber,
            status: 'draft',
            title: normalizeText(input.title, 'survey title'),
            description: input.description?.trim() || null,
            introTitle: input.introTitle?.trim() || null,
            introDescription: input.introDescription?.trim() || null,
            thankYouTitle: input.thankYouTitle?.trim() || null,
            thankYouDescription: input.thankYouDescription?.trim() || null,
            metadata: input.metadata ?? {},
            createdAt: now,
            updatedAt: now,
        });
        await tx.insert(surveyQuestions).values(
            normalizedQuestions.map((question) => ({
                id: randomUUID(),
                versionId,
                key: question.key,
                type: question.type,
                title: question.title,
                description: question.description,
                sortOrder: question.sortOrder,
                required: question.required,
                settings: question.settings,
                scoreMetadata: question.scoreMetadata,
                createdAt: now,
            })),
        );
    });

    return versionId;
}

export async function publishSurveyVersion({
    surveyId,
    versionId,
}: {
    surveyId: string;
    versionId: string;
}) {
    const [version, questions] = await Promise.all([
        getSurveyVersion(versionId),
        getSurveyQuestions(versionId),
    ]);
    if (!version || version.surveyId !== surveyId) {
        throw new Error('Survey version not found');
    }
    if (questions.length === 0) {
        throw new Error('Cannot publish a survey version without questions');
    }

    const now = new Date();
    await storage().transaction(async (tx) => {
        await tx
            .update(surveyVersions)
            .set({
                status: 'archived',
                archivedAt: now,
                updatedAt: now,
            })
            .where(
                and(
                    eq(surveyVersions.surveyId, surveyId),
                    eq(surveyVersions.status, 'published'),
                ),
            );
        await tx
            .update(surveyVersions)
            .set({
                status: 'published',
                publishedAt: now,
                archivedAt: null,
                updatedAt: now,
            })
            .where(eq(surveyVersions.id, versionId));
        await tx
            .update(surveys)
            .set({
                status: 'published',
                activeVersionId: versionId,
                title: version.title,
                description: version.description,
                updatedAt: now,
                archivedAt: null,
            })
            .where(eq(surveys.id, surveyId));
    });
}

export async function archiveSurvey(surveyId: string) {
    const now = new Date();
    await storage().transaction(async (tx) => {
        await tx
            .update(surveys)
            .set({
                status: 'archived',
                archivedAt: now,
                updatedAt: now,
            })
            .where(eq(surveys.id, surveyId));
        await tx
            .update(surveyVersions)
            .set({
                status: 'archived',
                archivedAt: now,
                updatedAt: now,
            })
            .where(eq(surveyVersions.surveyId, surveyId));
    });
}

export async function getPublishedSurveyVersionByKey(key: string) {
    const survey = await getSurveyByKey(key);
    if (!survey?.activeVersionId || survey.status !== 'published') {
        return null;
    }
    const version = await getSurveyVersion(survey.activeVersionId);
    if (version?.status !== 'published') {
        return null;
    }
    const questions = await getSurveyQuestions(version.id);
    return { survey, version, questions };
}

export async function listSurveysAdmin() {
    const surveyRows = await storage().query.surveys.findMany({
        orderBy: desc(surveys.updatedAt),
    });

    return await Promise.all(
        surveyRows.map(async (survey) => {
            const [versions, assignmentCountRows, responseCountRows] =
                await Promise.all([
                    storage().query.surveyVersions.findMany({
                        where: eq(surveyVersions.surveyId, survey.id),
                        orderBy: desc(surveyVersions.versionNumber),
                    }),
                    storage()
                        .select({ count: sql<number>`count(*)::int` })
                        .from(surveyAssignments)
                        .where(eq(surveyAssignments.surveyId, survey.id)),
                    storage()
                        .select({ count: sql<number>`count(*)::int` })
                        .from(surveyResponses)
                        .where(eq(surveyResponses.surveyId, survey.id)),
                ]);
            return {
                survey,
                versions,
                assignmentCount: Number(assignmentCountRows[0]?.count ?? 0),
                responseCount: Number(responseCountRows[0]?.count ?? 0),
            };
        }),
    );
}

async function membershipRowsForAudience(audience: SurveySendAudience) {
    const normalized = normalizeAudience(audience);

    if (normalized.type === 'accounts') {
        if (normalized.accountIds.length === 0) {
            return { rows: [], explicitCount: 0, unmatchedCount: 0 };
        }
        const rows = await storage()
            .select({
                accountId: accountUsers.accountId,
                userId: accountUsers.userId,
            })
            .from(accountUsers)
            .where(inArray(accountUsers.accountId, normalized.accountIds));
        return { rows, explicitCount: 0, unmatchedCount: 0 };
    }

    if (normalized.type === 'users') {
        if (normalized.userIds.length === 0) {
            return { rows: [], explicitCount: 0, unmatchedCount: 0 };
        }
        const rows = await storage()
            .select({
                accountId: accountUsers.accountId,
                userId: accountUsers.userId,
            })
            .from(accountUsers)
            .where(
                normalized.accountIds && normalized.accountIds.length > 0
                    ? and(
                          inArray(accountUsers.userId, normalized.userIds),
                          inArray(
                              accountUsers.accountId,
                              normalized.accountIds,
                          ),
                      )
                    : inArray(accountUsers.userId, normalized.userIds),
            );
        return { rows, explicitCount: 0, unmatchedCount: 0 };
    }

    const recipients = normalized.recipients;
    const accountOnlyRecipients = recipients.filter(
        (recipient) => !recipient.userId,
    );
    const userRecipients = recipients.filter(
        (recipient): recipient is { accountId: string; userId: string } =>
            Boolean(recipient.userId),
    );
    const userIds = uniqueStrings(
        userRecipients.map((recipient) => recipient.userId),
    );
    const accountIds = uniqueStrings(
        userRecipients.map((recipient) => recipient.accountId),
    );
    const memberships =
        userIds.length > 0 && accountIds.length > 0
            ? await storage()
                  .select({
                      accountId: accountUsers.accountId,
                      userId: accountUsers.userId,
                  })
                  .from(accountUsers)
                  .where(
                      and(
                          inArray(accountUsers.userId, userIds),
                          inArray(accountUsers.accountId, accountIds),
                      ),
                  )
            : [];
    const membershipKeys = new Set(
        memberships.map((membership) => recipientMembershipKey(membership)),
    );
    const matchedUserRows = userRecipients.filter((recipient) =>
        membershipKeys.has(recipientMembershipKey(recipient)),
    );
    const unmatchedCount = userRecipients.length - matchedUserRows.length;

    return {
        rows: [
            ...accountOnlyRecipients.map((recipient) => ({
                accountId: recipient.accountId,
                userId: '',
            })),
            ...matchedUserRows,
        ],
        explicitCount: recipients.length,
        unmatchedCount,
    };
}

function previewFromRows({
    audienceType,
    explicitCount = 0,
    rows,
    unmatchedCount = 0,
}: {
    audienceType: SurveySendAudience['type'];
    explicitCount?: number;
    rows: SurveyMembershipRow[];
    unmatchedCount?: number;
}): SurveyAudiencePreview {
    const recipients = normalizeRecipients(
        rows.map((row) => ({
            accountId: row.accountId,
            userId: row.userId || null,
        })),
    );
    return {
        audienceType,
        targetCount: recipients.length,
        accountCount: new Set(recipients.map((row) => row.accountId)).size,
        userCount: new Set(
            recipients.flatMap((row) => (row.userId ? [row.userId] : [])),
        ).size,
        explicitRecipientCount: explicitCount,
        unmatchedRecipientCount: unmatchedCount,
        recipients,
    };
}

export async function previewSurveyAudience(audience: SurveySendAudience) {
    const normalized = normalizeAudience(audience);
    const { rows, explicitCount, unmatchedCount } =
        await membershipRowsForAudience(normalized);
    return previewFromRows({
        audienceType: normalized.type,
        rows,
        explicitCount,
        unmatchedCount,
    });
}

async function resolvePublishedSurveyVersion({
    surveyId,
    surveyKey,
    versionId,
}: {
    surveyId?: string;
    surveyKey?: string;
    versionId?: string;
}) {
    if (versionId) {
        const version = await getSurveyVersion(versionId);
        if (version?.status !== 'published') {
            throw new Error('Published survey version not found');
        }
        const survey = await getSurveyById(version.surveyId);
        if (!survey) {
            throw new Error('Survey not found');
        }
        return { survey, version };
    }

    const survey =
        surveyId !== undefined
            ? await getSurveyById(surveyId)
            : surveyKey !== undefined
              ? await getSurveyByKey(surveyKey)
              : undefined;
    if (!survey?.activeVersionId || survey.status !== 'published') {
        throw new Error('Published survey not found');
    }
    const version = await getSurveyVersion(survey.activeVersionId);
    if (version?.status !== 'published') {
        throw new Error('Published survey version not found');
    }
    return { survey, version };
}

export async function createSurveyAssignments({
    context = {},
    contextKey,
    expiresAt,
    recipients,
    sendId,
    surveyId,
    surveyKey,
    versionId,
}: {
    context?: SurveyAssignmentContext;
    contextKey: string;
    expiresAt?: Date | null;
    recipients: SurveyRecipient[];
    sendId?: string | null;
    surveyId?: string;
    surveyKey?: string;
    versionId?: string;
}): Promise<SurveyAssignmentResult> {
    const { survey, version } = await resolvePublishedSurveyVersion({
        surveyId,
        surveyKey,
        versionId,
    });
    const normalizedRecipients = normalizeRecipients(recipients);
    const assignments: SurveyAssignmentSummary[] = [];
    const now = new Date();

    for (const recipient of normalizedRecipients) {
        const insertRow = {
            id: randomUUID(),
            surveyId: survey.id,
            versionId: version.id,
            sendId: sendId ?? null,
            accountId: recipient.accountId,
            userId: recipient.userId ?? null,
            targetKey: targetKey(recipient),
            contextKey: normalizeText(contextKey, 'contextKey'),
            status: 'pending' as const,
            context,
            expiresAt: expiresAt ?? null,
            createdAt: now,
            updatedAt: now,
        };
        const inserted = await storage()
            .insert(surveyAssignments)
            .values(insertRow)
            .onConflictDoNothing()
            .returning();

        if (inserted[0]) {
            assignments.push({
                assignment: inserted[0],
                duplicate: false,
            });
            continue;
        }

        const existing = await storage().query.surveyAssignments.findFirst({
            where: and(
                eq(surveyAssignments.versionId, version.id),
                eq(surveyAssignments.targetKey, insertRow.targetKey),
                eq(surveyAssignments.contextKey, insertRow.contextKey),
            ),
        });
        if (existing) {
            assignments.push({
                assignment: existing,
                duplicate: true,
            });
        }
    }

    return {
        assignments,
        createdCount: assignments.filter((item) => !item.duplicate).length,
        skippedDuplicateCount: assignments.filter((item) => item.duplicate)
            .length,
    };
}

export async function createSurveySend({
    audience,
    channelPolicy,
    context = {},
    contextKey,
    createdByUserId,
    createdFromAccountId,
    expiresAt,
    metadata = {},
    name,
    scheduledAt,
    surveyId,
    surveyKey,
    versionId,
}: {
    audience: SurveySendAudience;
    channelPolicy: SurveySendChannelPolicy;
    context?: SurveyAssignmentContext;
    contextKey: string;
    createdByUserId?: string | null;
    createdFromAccountId?: string | null;
    expiresAt?: Date | null;
    metadata?: Record<string, unknown>;
    name: string;
    scheduledAt?: Date | null;
    surveyId?: string;
    surveyKey?: string;
    versionId?: string;
}): Promise<SurveySendResult> {
    const { survey, version } = await resolvePublishedSurveyVersion({
        surveyId,
        surveyKey,
        versionId,
    });
    const normalizedAudience = normalizeAudience(audience);
    const preview = await previewSurveyAudience(normalizedAudience);
    const sendId = randomUUID();
    const now = new Date();

    const [send] = await storage()
        .insert(surveySends)
        .values({
            id: sendId,
            surveyId: survey.id,
            versionId: version.id,
            status: scheduledAt && scheduledAt > now ? 'scheduled' : 'sent',
            name: normalizeText(name, 'send name'),
            audience: normalizedAudience,
            channelPolicy,
            contextKey: normalizeText(contextKey, 'contextKey'),
            metadata,
            targetCount: preview.targetCount,
            createdByUserId: createdByUserId ?? null,
            createdFromAccountId: createdFromAccountId ?? null,
            scheduledAt: scheduledAt ?? null,
            sentAt: scheduledAt && scheduledAt > now ? null : now,
            createdAt: now,
            updatedAt: now,
        })
        .returning();

    const assignmentResult = await createSurveyAssignments({
        context,
        contextKey,
        expiresAt,
        recipients: preview.recipients,
        sendId,
        versionId: version.id,
    });

    await storage()
        .update(surveySends)
        .set({
            assignedCount: assignmentResult.createdCount,
            skippedDuplicateCount: assignmentResult.skippedDuplicateCount,
            updatedAt: new Date(),
        })
        .where(eq(surveySends.id, sendId));

    const updatedSend = await storage().query.surveySends.findFirst({
        where: eq(surveySends.id, sendId),
    });

    return {
        ...assignmentResult,
        send: updatedSend ?? send,
        preview,
    };
}

export async function recordSurveySendDelivery({
    assignmentId,
    channel,
    email,
    errorMessage,
    metadata = {},
    notificationId,
    status,
}: {
    assignmentId?: string | null;
    channel: SurveySendDeliveryChannel;
    email?: string | null;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
    notificationId?: string | null;
    status: SurveySendDeliveryStatus;
}) {
    if (!assignmentId) {
        return null;
    }
    const assignment = await storage().query.surveyAssignments.findFirst({
        where: eq(surveyAssignments.id, assignmentId),
    });
    if (!assignment?.sendId) {
        return null;
    }
    const [delivery] = await storage()
        .insert(surveySendDeliveries)
        .values({
            id: randomUUID(),
            sendId: assignment.sendId,
            assignmentId,
            accountId: assignment.accountId,
            userId: assignment.userId,
            channel,
            status,
            email: email ?? null,
            notificationId: notificationId ?? null,
            errorMessage: errorMessage ?? null,
            metadata,
        })
        .returning();
    return delivery;
}

function assignmentIsExpired(assignment: SelectSurveyAssignment, now: Date) {
    return Boolean(assignment.expiresAt && assignment.expiresAt <= now);
}

function assignmentBelongsToCurrentUser({
    accountId,
    assignment,
    userId,
}: {
    accountId: string;
    assignment: SelectSurveyAssignment;
    userId: string;
}) {
    if (assignment.userId && assignment.userId !== userId) {
        return false;
    }
    if (assignment.accountId && assignment.accountId !== accountId) {
        return false;
    }
    return Boolean(assignment.userId || assignment.accountId);
}

export async function getSurveyAssignmentRuntime({
    accountId,
    assignmentId,
    markOpened = false,
    userId,
}: {
    accountId: string;
    assignmentId: string;
    markOpened?: boolean;
    userId: string;
}): Promise<SurveyRuntimeAssignment | null> {
    const assignment = await storage().query.surveyAssignments.findFirst({
        where: eq(surveyAssignments.id, assignmentId),
    });
    if (!assignment) {
        return null;
    }
    if (!assignmentBelongsToCurrentUser({ accountId, assignment, userId })) {
        return null;
    }

    const now = new Date();
    if (
        assignment.status === 'pending' &&
        assignmentIsExpired(assignment, now)
    ) {
        await storage()
            .update(surveyAssignments)
            .set({ status: 'expired', updatedAt: now })
            .where(eq(surveyAssignments.id, assignment.id));
        assignment.status = 'expired';
    }

    if (markOpened && !assignment.openedAt) {
        await storage()
            .update(surveyAssignments)
            .set({ openedAt: now, updatedAt: now })
            .where(eq(surveyAssignments.id, assignment.id));
        assignment.openedAt = now;
    }

    const [survey, version, questions, response] = await Promise.all([
        getSurveyById(assignment.surveyId),
        getSurveyVersion(assignment.versionId),
        getSurveyQuestions(assignment.versionId),
        storage().query.surveyResponses.findFirst({
            where: eq(surveyResponses.assignmentId, assignment.id),
        }),
    ]);

    if (!survey || !version) {
        return null;
    }

    return {
        assignment,
        survey,
        version,
        questions,
        response: response ?? null,
    };
}

export async function listAssignedSurveysForUser({
    accountId,
    userId,
}: {
    accountId: string;
    userId: string;
}) {
    const rows = await storage().query.surveyAssignments.findMany({
        where: and(
            eq(surveyAssignments.accountId, accountId),
            inArray(surveyAssignments.status, ['pending', 'started']),
        ),
        orderBy: desc(surveyAssignments.createdAt),
    });
    return rows.filter(
        (assignment) => !assignment.userId || assignment.userId === userId,
    );
}

export async function startSurveyAssignment({
    accountId,
    assignmentId,
    userId,
}: {
    accountId: string;
    assignmentId: string;
    userId: string;
}) {
    const runtime = await getSurveyAssignmentRuntime({
        accountId,
        assignmentId,
        userId,
    });
    if (!runtime) return null;
    if (runtime.assignment.status !== 'pending') {
        return runtime.assignment;
    }
    const now = new Date();
    const [updated] = await storage()
        .update(surveyAssignments)
        .set({
            status: 'started',
            startedAt: now,
            updatedAt: now,
        })
        .where(eq(surveyAssignments.id, assignmentId))
        .returning();
    return updated;
}

function answerKey(answer: SurveyAnswerInput) {
    return answer.questionId ?? answer.questionKey ?? '';
}

function isContactAnswer(value: unknown): value is SurveyContactAnswer {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    return Object.values(value).every(
        (fieldValue) =>
            fieldValue === undefined || typeof fieldValue === 'string',
    );
}

function normalizeContactAnswer(value: SurveyContactAnswer) {
    const normalized: SurveyContactAnswer = {};
    if (value.firstName?.trim()) normalized.firstName = value.firstName.trim();
    if (value.lastName?.trim()) normalized.lastName = value.lastName.trim();
    if (value.phone?.trim()) normalized.phone = value.phone.trim();
    if (value.email?.trim()) normalized.email = value.email.trim();
    return normalized;
}

function contactHasValue(value: SurveyContactAnswer) {
    return Object.keys(value).length > 0;
}

type ValidatedSurveyAnswer =
    | {
          error: string;
      }
    | {
          skipped: true;
      }
    | {
          numericValue: number;
      }
    | {
          textValue: string;
      }
    | {
          contactValue: SurveyContactAnswer;
      };

function validateAnswerForQuestion(
    question: SelectSurveyQuestion,
    answer: SurveyAnswerInput | undefined,
): ValidatedSurveyAnswer {
    const value = answer?.value;
    if (value === undefined || value === null || value === '') {
        if (question.required) {
            return { error: 'Ovo pitanje je obavezno.' };
        }
        return { skipped: true as const };
    }

    if (question.type === 'opinion_scale') {
        const settings = question.settings;
        if (settings.type !== 'opinion_scale') {
            return { error: 'Pitanje nema valjanu skalu.' };
        }
        const numeric =
            typeof value === 'number'
                ? value
                : typeof value === 'string'
                  ? Number.parseInt(value, 10)
                  : Number.NaN;
        if (
            !Number.isInteger(numeric) ||
            numeric < settings.min ||
            numeric > settings.max
        ) {
            return {
                error: `Odaberi ocjenu od ${settings.min} do ${settings.max}.`,
            };
        }
        return { numericValue: numeric };
    }

    if (question.type === 'long_text') {
        if (typeof value !== 'string') {
            return { error: 'Odgovor mora biti tekst.' };
        }
        const textValue = value.trim();
        const settings = question.settings;
        if (
            settings.type === 'long_text' &&
            settings.maxLength &&
            textValue.length > settings.maxLength
        ) {
            return {
                error: `Odgovor može imati najviše ${settings.maxLength} znakova.`,
            };
        }
        if (!textValue && question.required) {
            return { error: 'Ovo pitanje je obavezno.' };
        }
        return textValue ? { textValue } : { skipped: true as const };
    }

    if (!isContactAnswer(value)) {
        return { error: 'Kontakt podaci nisu valjani.' };
    }
    const contactValue = normalizeContactAnswer(value);
    if (!contactHasValue(contactValue)) {
        if (question.required) {
            return { error: 'Unesi barem jedan kontakt podatak.' };
        }
        return { skipped: true as const };
    }
    return { contactValue };
}

export async function submitSurveyResponse({
    accountId,
    answers,
    assignmentId,
    metadata = {},
    userId,
}: {
    accountId: string;
    answers: SurveyAnswerInput[];
    assignmentId: string;
    metadata?: Record<string, unknown>;
    userId: string;
}): Promise<SurveySubmitResult> {
    const runtime = await getSurveyAssignmentRuntime({
        accountId,
        assignmentId,
        userId,
    });
    if (!runtime) {
        return {
            ok: false,
            status: 'not_found',
            message: 'Anketa nije pronađena.',
        };
    }
    if (
        !assignmentBelongsToCurrentUser({
            accountId,
            assignment: runtime.assignment,
            userId,
        })
    ) {
        return {
            ok: false,
            status: 'unauthorized',
            message: 'Nemaš pristup ovoj anketi.',
        };
    }
    if (runtime.assignment.status === 'submitted' || runtime.response) {
        return {
            ok: false,
            status: 'already_submitted',
            message: 'Anketa je već poslana.',
        };
    }
    if (
        runtime.assignment.status === 'expired' ||
        assignmentIsExpired(runtime.assignment, new Date())
    ) {
        return {
            ok: false,
            status: 'expired',
            message: 'Ova anketa više nije aktivna.',
        };
    }

    const answersByKey = new Map(
        answers.map((answer) => [answerKey(answer), answer]),
    );
    const fieldErrors: Record<string, string> = {};
    const answerRows: Array<
        Pick<
            typeof surveyAnswers.$inferInsert,
            | 'contactValue'
            | 'numericValue'
            | 'questionId'
            | 'questionKey'
            | 'responseId'
            | 'skipped'
            | 'textValue'
            | 'type'
        >
    > = [];

    const responseId = randomUUID();
    for (const question of runtime.questions) {
        const answer =
            answersByKey.get(question.id) ?? answersByKey.get(question.key);
        const result = validateAnswerForQuestion(question, answer);
        if ('error' in result) {
            fieldErrors[question.key] = result.error;
            continue;
        }
        answerRows.push({
            responseId,
            questionId: question.id,
            questionKey: question.key,
            type: question.type,
            skipped: 'skipped' in result ? result.skipped : false,
            numericValue: 'numericValue' in result ? result.numericValue : null,
            textValue: 'textValue' in result ? result.textValue : null,
            contactValue: 'contactValue' in result ? result.contactValue : null,
        });
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            ok: false,
            status: 'invalid',
            message: 'Provjeri odgovore i pokušaj ponovno.',
            fieldErrors,
        };
    }

    const now = new Date();
    await storage().transaction(async (tx) => {
        await tx.insert(surveyResponses).values({
            id: responseId,
            assignmentId: runtime.assignment.id,
            surveyId: runtime.survey.id,
            versionId: runtime.version.id,
            accountId: runtime.assignment.accountId ?? accountId,
            userId,
            source: 'in_app',
            status: 'submitted',
            metadata,
            startedAt: runtime.assignment.startedAt,
            submittedAt: now,
            createdAt: now,
        });
        await tx.insert(surveyAnswers).values(
            answerRows.map((answer) => ({
                id: randomUUID(),
                ...answer,
                createdAt: now,
            })),
        );
        await tx
            .update(surveyAssignments)
            .set({
                status: 'submitted',
                submittedAt: now,
                updatedAt: now,
            })
            .where(eq(surveyAssignments.id, runtime.assignment.id));
    });

    return {
        ok: true,
        responseId,
    };
}

export async function getSurveyResultsAdmin({
    from,
    monthKey,
    surveyId,
    to,
    versionId,
}: {
    from?: Date | null;
    monthKey?: string | null;
    surveyId: string;
    to?: Date | null;
    versionId?: string | null;
}): Promise<SurveyResults | null> {
    const survey = await getSurveyById(surveyId);
    if (!survey) return null;

    const versions = await storage().query.surveyVersions.findMany({
        where: eq(surveyVersions.surveyId, surveyId),
        orderBy: desc(surveyVersions.versionNumber),
    });
    const selectedVersionIds = versionId
        ? [versionId]
        : versions.map((version) => version.id);
    if (selectedVersionIds.length === 0) {
        return {
            survey,
            versions,
            questions: [],
            responses: [],
            numericAggregates: [],
        };
    }

    const questions = await storage().query.surveyQuestions.findMany({
        where: inArray(surveyQuestions.versionId, selectedVersionIds),
        orderBy: [asc(surveyQuestions.sortOrder)],
    });
    const responseRows = await storage().query.surveyResponses.findMany({
        where: inArray(surveyResponses.versionId, selectedVersionIds),
        orderBy: desc(surveyResponses.submittedAt),
    });
    const responseIds = responseRows.map((response) => response.id);
    const assignmentIds = responseRows.flatMap((response) =>
        response.assignmentId ? [response.assignmentId] : [],
    );
    const [answerRows, assignmentRows] = await Promise.all([
        responseIds.length > 0
            ? storage().query.surveyAnswers.findMany({
                  where: inArray(surveyAnswers.responseId, responseIds),
                  orderBy: asc(surveyAnswers.createdAt),
              })
            : [],
        assignmentIds.length > 0
            ? storage().query.surveyAssignments.findMany({
                  where: inArray(surveyAssignments.id, assignmentIds),
              })
            : [],
    ]);
    const assignmentById = new Map(
        assignmentRows.map((assignment) => [assignment.id, assignment]),
    );
    const answersByResponseId = new Map<
        string,
        Array<typeof surveyAnswers.$inferSelect>
    >();
    for (const answer of answerRows) {
        const existing = answersByResponseId.get(answer.responseId) ?? [];
        existing.push(answer);
        answersByResponseId.set(answer.responseId, existing);
    }

    const filteredResponses = responseRows.filter((response) => {
        if (from && response.submittedAt < from) return false;
        if (to && response.submittedAt > to) return false;
        if (monthKey) {
            const assignment = response.assignmentId
                ? assignmentById.get(response.assignmentId)
                : undefined;
            if (assignment?.context.monthKey !== monthKey) return false;
        }
        return true;
    });

    const responses = filteredResponses.map((response) => ({
        response,
        assignment: response.assignmentId
            ? (assignmentById.get(response.assignmentId) ?? null)
            : null,
        answers: answersByResponseId.get(response.id) ?? [],
    }));

    return {
        survey,
        versions,
        questions,
        responses,
        numericAggregates: buildNumericAggregates(questions, responses),
    };
}

function median(values: number[]) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) {
        return sorted[middle] ?? null;
    }
    const left = sorted[middle - 1];
    const right = sorted[middle];
    if (left === undefined || right === undefined) return null;
    return (left + right) / 2;
}

export function buildNumericAggregates(
    questions: SelectSurveyQuestion[],
    responses: SurveyResponseDetail[],
): SurveyNumericAggregate[] {
    return questions
        .filter((question) => question.type === 'opinion_scale')
        .map((question) => {
            const values: number[] = [];
            let unansweredCount = 0;
            const distribution: Record<string, number> = {};

            for (const response of responses) {
                const answer = response.answers.find(
                    (item) => item.questionId === question.id,
                );
                if (!answer || answer.skipped || answer.numericValue === null) {
                    unansweredCount += 1;
                    continue;
                }
                values.push(answer.numericValue);
                const key = answer.numericValue.toString();
                distribution[key] = (distribution[key] ?? 0) + 1;
            }

            const sum = values.reduce((total, value) => total + value, 0);
            return {
                questionId: question.id,
                questionKey: question.key,
                title: question.title,
                count: values.length,
                unansweredCount,
                average: values.length > 0 ? sum / values.length : null,
                median: median(values),
                distribution,
                scoreMetadata: question.scoreMetadata,
            };
        });
}

export async function getSurveyAdminDetails(surveyId: string) {
    const survey = await getSurveyById(surveyId);
    if (!survey) return null;
    const [versions, sends, assignments, results] = await Promise.all([
        storage().query.surveyVersions.findMany({
            where: eq(surveyVersions.surveyId, surveyId),
            orderBy: desc(surveyVersions.versionNumber),
        }),
        storage().query.surveySends.findMany({
            where: eq(surveySends.surveyId, surveyId),
            orderBy: desc(surveySends.createdAt),
            limit: 50,
        }),
        storage().query.surveyAssignments.findMany({
            where: eq(surveyAssignments.surveyId, surveyId),
            orderBy: desc(surveyAssignments.createdAt),
            limit: 50,
        }),
        getSurveyResultsAdmin({ surveyId }),
    ]);
    const questionGroups = await Promise.all(
        versions.map(async (version) => ({
            version,
            questions: await getSurveyQuestions(version.id),
        })),
    );
    return {
        survey,
        versions,
        questionGroups,
        sends,
        assignments,
        results,
    };
}

export async function seedDeliverySatisfactionSurveyDefinition({
    createdByUserId,
    publish = false,
}: {
    createdByUserId?: string | null;
    publish?: boolean;
} = {}) {
    const existing = await getSurveyByKey(DELIVERY_SATISFACTION_SURVEY_KEY);
    if (existing) {
        if (publish && existing.activeVersionId) {
            const activeVersion = await getSurveyVersion(
                existing.activeVersionId,
            );
            if (activeVersion?.status === 'draft') {
                await publishSurveyVersion({
                    surveyId: existing.id,
                    versionId: activeVersion.id,
                });
            }
        }
        return existing;
    }

    const { surveyId, versionId } = await createSurveyDefinition({
        key: DELIVERY_SATISFACTION_SURVEY_KEY,
        title: 'Zadovoljstvo dostavom',
        description:
            'Kratka anketa o kvaliteti povrća, dostavi i komunikaciji Gredice tima.',
        category: 'delivery',
        introTitle: 'Anketa zadovoljstva',
        introDescription:
            'Anketa je o zadovoljstvu dostavom povrća iz digitalnog vrta. Odgovori su povezani s dostavnim razdobljem kako bismo mogli bolje razumjeti povratnu informaciju.',
        thankYouTitle: 'Hvala ti na odgovoru!',
        thankYouDescription:
            'Tvoj odgovor pomaže da sljedeća dostava bude još bolja.',
        createdByUserId,
        metadata: {
            source: 'typeform_replacement',
            typeformId: DELIVERY_SATISFACTION_TYPEFORM_ID,
            typeformUrl: DELIVERY_SATISFACTION_TYPEFORM_URL,
        },
        questions: [
            {
                key: 'vegetable_quality',
                title: 'Kako ti se čini kvaliteta povrća?',
                description:
                    'Ocijeni kvalitetu povrća/biljaka koje je stiglo u tvoje ruke.',
                type: 'opinion_scale',
                required: false,
                settings: {
                    type: 'opinion_scale',
                    min: 0,
                    max: 10,
                    step: 1,
                },
                scoreMetadata: {
                    internalScore: true,
                    publicScore: false,
                },
            },
            {
                key: 'delivery_speed_quality',
                title: 'Ocijena za brzinu i kvalitetu dostave?',
                type: 'opinion_scale',
                required: false,
                settings: {
                    type: 'opinion_scale',
                    min: 0,
                    max: 10,
                    step: 1,
                },
                scoreMetadata: {
                    internalScore: true,
                    publicScore: false,
                },
            },
            {
                key: 'team_communication',
                title: 'Kako ti se čini komunikacija s našim timom?',
                type: 'opinion_scale',
                required: false,
                settings: {
                    type: 'opinion_scale',
                    min: 0,
                    max: 10,
                    step: 1,
                },
                scoreMetadata: {
                    internalScore: true,
                    publicScore: false,
                },
            },
            {
                key: 'improvement_text',
                title: 'Što možemo bolje?',
                description:
                    'Možeš nam dati par savjeta i ideja da iduća dostava bude još bolja!',
                type: 'long_text',
                required: false,
                settings: {
                    type: 'long_text',
                    maxLength: 2000,
                },
            },
        ],
    });

    if (publish) {
        await publishSurveyVersion({ surveyId, versionId });
    }

    const survey = await getSurveyById(surveyId);
    if (!survey) {
        throw new Error('Delivery satisfaction survey was not created');
    }
    return survey;
}

export async function ensureDeliverySatisfactionSurveyPublished() {
    const seeded = await seedDeliverySatisfactionSurveyDefinition({
        publish: true,
    });
    if (seeded.activeVersionId && seeded.status === 'published') {
        const version = await getSurveyVersion(seeded.activeVersionId);
        if (version?.status === 'published') {
            return { survey: seeded, version };
        }
    }

    const draftVersion = await storage().query.surveyVersions.findFirst({
        where: eq(surveyVersions.surveyId, seeded.id),
        orderBy: desc(surveyVersions.versionNumber),
    });
    if (!draftVersion) {
        throw new Error('Delivery satisfaction survey has no version');
    }
    await publishSurveyVersion({
        surveyId: seeded.id,
        versionId: draftVersion.id,
    });
    const published = await getSurveyById(seeded.id);
    const version = published?.activeVersionId
        ? await getSurveyVersion(published.activeVersionId)
        : null;
    if (!published || !version) {
        throw new Error('Delivery satisfaction survey could not be published');
    }
    return { survey: published, version };
}

export async function findDeliverySatisfactionAssignment({
    accountId,
    monthKey,
}: {
    accountId: string;
    monthKey: string;
}) {
    const published = await getPublishedSurveyVersionByKey(
        DELIVERY_SATISFACTION_SURVEY_KEY,
    );
    if (!published) return null;
    return await storage().query.surveyAssignments.findFirst({
        where: and(
            eq(surveyAssignments.versionId, published.version.id),
            eq(surveyAssignments.targetKey, targetKey({ accountId })),
            eq(
                surveyAssignments.contextKey,
                `delivery:${accountId}:${monthKey}`,
            ),
        ),
    });
}

export type SurveyUserRecord = Pick<
    typeof users.$inferSelect,
    'displayName' | 'id' | 'userName'
>;

export async function listSurveyTargetUsers() {
    const rows = await storage()
        .select({
            id: users.id,
            userName: users.userName,
            displayName: users.displayName,
            accountId: accountUsers.accountId,
        })
        .from(accountUsers)
        .innerJoin(accounts, eq(accountUsers.accountId, accounts.id))
        .innerJoin(users, eq(accountUsers.userId, users.id))
        .orderBy(asc(accountUsers.createdAt));

    return rows.map((row) => ({
        id: row.id,
        userName: row.userName,
        displayName: row.displayName,
        accountId: row.accountId,
    }));
}
