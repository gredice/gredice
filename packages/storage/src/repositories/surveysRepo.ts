import 'server-only';
import { randomUUID } from 'node:crypto';
import {
    and,
    asc,
    count,
    desc,
    eq,
    gte,
    inArray,
    lte,
    or,
    sql,
} from 'drizzle-orm';
import {
    accounts,
    accountUsers,
    type SelectSurvey,
    type SelectSurveyAnswer,
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

export type SurveyVersionDefinitionInput = Omit<
    SurveyDefinitionInput,
    'key' | 'category' | 'createdByUserId'
>;

export type DuplicateSurveyDefinitionInput = {
    sourceSurveyId: string;
    sourceVersionId: string;
    key: string;
    title: string;
    createdByUserId?: string | null;
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
    versionId: string;
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

export type SurveyResponseSource = SelectSurveyResponse['source'];

export type SurveyResponseFilters = {
    versionId?: string | null;
    submittedFrom?: Date | null;
    submittedTo?: Date | null;
    accountId?: string | null;
    userId?: string | null;
    monthKey?: string | null;
    contextQuery?: string | null;
    source?: SurveyResponseSource | null;
};

export type SurveyResponsePageRequest = SurveyResponseFilters & {
    surveyId: string;
    page?: number;
    pageSize?: number;
};

export type SurveyResponseAnswerDetail = {
    answer: SelectSurveyAnswer;
    question: SelectSurveyQuestion;
};

export type SurveyResponseDetail = {
    response: SelectSurveyResponse;
    assignment: SelectSurveyAssignment | null;
    version: SelectSurveyVersion;
    accountId: string | null;
    user: SurveyUserRecord | null;
    answers: SurveyResponseAnswerDetail[];
};

export type SurveyResponsePage = {
    survey: SelectSurvey;
    versions: SelectSurveyVersion[];
    questions: SelectSurveyQuestion[];
    responses: SurveyResponseDetail[];
    numericAggregates: SurveyNumericAggregate[];
    totalCount: number;
    page: number;
    pageSize: number;
    pageCount: number;
    appliedVersionId: string | null;
};

export type SurveyResponseExportRequest = SurveyResponseFilters & {
    surveyId: string;
    maximumResponseCount?: number;
};

export type SurveyResponseExportPreparation =
    | {
          status: 'ready';
          survey: SelectSurvey;
          versions: SelectSurveyVersion[];
          questions: SelectSurveyQuestion[];
          responseIds: string[];
          appliedVersionId: string | null;
      }
    | {
          status: 'too_large';
          reason: 'responses';
      };

export type SurveyResponseExportRow = SurveyResponseDetail;

export type SurveyResults = {
    survey: SelectSurvey;
    versions: SelectSurveyVersion[];
    questions: SelectSurveyQuestion[];
    responses: Array<{
        response: SelectSurveyResponse;
        assignment: SelectSurveyAssignment | null;
        answers: SelectSurveyAnswer[];
    }>;
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
        if (
            settings.step !== undefined &&
            (!Number.isInteger(settings.step) ||
                settings.step < 1 ||
                settings.step > settings.max - settings.min ||
                (settings.max - settings.min) % settings.step !== 0)
        ) {
            throw new Error(
                'Opinion scale step must evenly divide the configured bounds',
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

export async function createSurveyDraftVersion(
    surveyId: string,
    input: SurveyVersionDefinitionInput,
) {
    const normalizedQuestions = validateQuestions(input.questions);
    const versionId = randomUUID();
    const now = new Date();

    return await storage().transaction(async (tx) => {
        const [survey] = await tx
            .select({ id: surveys.id })
            .from(surveys)
            .where(eq(surveys.id, surveyId))
            .limit(1)
            .for('update');
        if (!survey) {
            throw new Error('Survey not found');
        }
        const [latestVersion] = await tx
            .select({
                versionNumber: surveyVersions.versionNumber,
            })
            .from(surveyVersions)
            .where(eq(surveyVersions.surveyId, surveyId))
            .orderBy(desc(surveyVersions.versionNumber))
            .limit(1);
        const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;

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

        return {
            versionId,
            versionNumber,
        };
    });
}

export async function updateSurveyDraftVersion({
    definition,
    surveyId,
    versionId,
}: {
    definition: SurveyVersionDefinitionInput;
    surveyId: string;
    versionId: string;
}) {
    const normalizedQuestions = validateQuestions(definition.questions);
    const now = new Date();

    return await storage().transaction(async (tx) => {
        const [survey] = await tx
            .select({ id: surveys.id })
            .from(surveys)
            .where(eq(surveys.id, surveyId))
            .limit(1)
            .for('update');
        if (!survey) {
            throw new Error('Survey not found');
        }
        const [version] = await tx
            .select()
            .from(surveyVersions)
            .where(
                and(
                    eq(surveyVersions.id, versionId),
                    eq(surveyVersions.surveyId, surveyId),
                ),
            )
            .limit(1)
            .for('update');
        if (!version) {
            throw new Error('Survey version not found');
        }
        if (version.status !== 'draft') {
            throw new Error('Only draft survey versions can be edited');
        }

        const send = await tx
            .select({ id: surveySends.id })
            .from(surveySends)
            .where(eq(surveySends.versionId, versionId))
            .limit(1);
        const assignment = await tx
            .select({ id: surveyAssignments.id })
            .from(surveyAssignments)
            .where(eq(surveyAssignments.versionId, versionId))
            .limit(1);
        const response = await tx
            .select({ id: surveyResponses.id })
            .from(surveyResponses)
            .where(eq(surveyResponses.versionId, versionId))
            .limit(1);
        if (send.length > 0 || assignment.length > 0 || response.length > 0) {
            throw new Error(
                'Survey versions with operational history cannot be edited',
            );
        }

        const normalizedTitle = normalizeText(definition.title, 'survey title');
        const normalizedDescription = definition.description?.trim() || null;
        await tx
            .update(surveyVersions)
            .set({
                title: normalizedTitle,
                description: normalizedDescription,
                introTitle: definition.introTitle?.trim() || null,
                introDescription: definition.introDescription?.trim() || null,
                thankYouTitle: definition.thankYouTitle?.trim() || null,
                thankYouDescription:
                    definition.thankYouDescription?.trim() || null,
                metadata: definition.metadata ?? version.metadata,
                updatedAt: now,
            })
            .where(eq(surveyVersions.id, versionId));

        await tx
            .delete(surveyQuestions)
            .where(eq(surveyQuestions.versionId, versionId));
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

        if (version.versionNumber === 1) {
            await tx
                .update(surveys)
                .set({
                    title: normalizedTitle,
                    description: normalizedDescription,
                    updatedAt: now,
                })
                .where(
                    and(
                        eq(surveys.id, surveyId),
                        eq(surveys.status, 'draft'),
                        sql`${surveys.activeVersionId} is null`,
                    ),
                );
        }

        return {
            surveyId,
            versionId,
            versionNumber: version.versionNumber,
        };
    });
}

export async function duplicateSurveyDefinition(
    input: DuplicateSurveyDefinitionInput,
) {
    const surveyId = randomUUID();
    const versionId = randomUUID();
    const now = new Date();

    return await storage().transaction(async (tx) => {
        const [sourceVersion] = await tx
            .select()
            .from(surveyVersions)
            .where(
                and(
                    eq(surveyVersions.id, input.sourceVersionId),
                    eq(surveyVersions.surveyId, input.sourceSurveyId),
                ),
            )
            .limit(1)
            .for('update');
        if (!sourceVersion) {
            throw new Error('Source survey version not found');
        }

        const sourceSurvey = await tx
            .select()
            .from(surveys)
            .where(eq(surveys.id, input.sourceSurveyId))
            .limit(1);
        const sourceQuestions = await tx
            .select()
            .from(surveyQuestions)
            .where(eq(surveyQuestions.versionId, sourceVersion.id))
            .orderBy(asc(surveyQuestions.sortOrder));
        const source = sourceSurvey[0];
        if (!source) {
            throw new Error('Source survey not found');
        }
        if (sourceQuestions.length === 0) {
            throw new Error('Source survey version has no questions');
        }

        const key = normalizeText(input.key, 'survey key');
        const title = normalizeText(input.title, 'survey title');
        await tx.insert(surveys).values({
            id: surveyId,
            key,
            title,
            description: sourceVersion.description,
            category: source.category,
            status: 'draft',
            activeVersionId: null,
            metadata: source.metadata,
            createdByUserId: input.createdByUserId ?? null,
            createdAt: now,
            updatedAt: now,
            archivedAt: null,
        });
        await tx.insert(surveyVersions).values({
            id: versionId,
            surveyId,
            versionNumber: 1,
            status: 'draft',
            title,
            description: sourceVersion.description,
            introTitle: sourceVersion.introTitle,
            introDescription: sourceVersion.introDescription,
            thankYouTitle: sourceVersion.thankYouTitle,
            thankYouDescription: sourceVersion.thankYouDescription,
            metadata: sourceVersion.metadata,
            createdAt: now,
            updatedAt: now,
            publishedAt: null,
            archivedAt: null,
        });
        await tx.insert(surveyQuestions).values(
            sourceQuestions.map((question) => ({
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

        return {
            surveyId,
            versionId,
            versionNumber: 1,
            sourceSurveyId: source.id,
            sourceVersionId: sourceVersion.id,
            sourceVersionNumber: sourceVersion.versionNumber,
        };
    });
}

export async function publishSurveyVersion({
    surveyId,
    versionId,
}: {
    surveyId: string;
    versionId: string;
}) {
    const now = new Date();
    await storage().transaction(async (tx) => {
        const [survey] = await tx
            .select({ id: surveys.id })
            .from(surveys)
            .where(eq(surveys.id, surveyId))
            .limit(1)
            .for('update');
        if (!survey) {
            throw new Error('Survey not found');
        }
        const [version] = await tx
            .select()
            .from(surveyVersions)
            .where(
                and(
                    eq(surveyVersions.id, versionId),
                    eq(surveyVersions.surveyId, surveyId),
                ),
            )
            .limit(1)
            .for('update');
        if (!version) {
            throw new Error('Survey version not found');
        }
        if (version.status !== 'draft') {
            throw new Error('Only draft survey versions can be published');
        }
        const questions = await tx
            .select({ id: surveyQuestions.id })
            .from(surveyQuestions)
            .where(eq(surveyQuestions.versionId, versionId))
            .limit(1);
        if (questions.length === 0) {
            throw new Error(
                'Cannot publish a survey version without questions',
            );
        }

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
            numeric > settings.max ||
            (numeric - settings.min) % (settings.step ?? 1) !== 0
        ) {
            return {
                error: `Odaberi jednu od ponuđenih ocjena od ${settings.min} do ${settings.max}.`,
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

const defaultSurveyResponsePageSize = 25;
const maximumSurveyResponsePageSize = 100;
const maximumSurveyResponseExportCount = 50_000;
const maximumSurveyResponseExportBatchSize = 500;

function normalizePositiveInteger(value: number | undefined, fallback: number) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(1, Math.trunc(value ?? fallback));
}

function resolvedSurveyResponseAccountId() {
    return sql<
        string | null
    >`coalesce(${surveyResponses.accountId}, ${surveyAssignments.accountId})`;
}

function resolvedSurveyResponseUserId() {
    return sql<
        string | null
    >`coalesce(${surveyResponses.userId}, ${surveyAssignments.userId})`;
}

function escapeSurveyContextSearch(value: string) {
    return value
        .replaceAll('\\', '\\\\')
        .replaceAll('%', '\\%')
        .replaceAll('_', '\\_');
}

function surveyResponseWhere({
    filters,
    surveyId,
    versionIds,
}: {
    filters: SurveyResponseFilters;
    surveyId: string;
    versionIds: string[];
}) {
    const accountId = filters.accountId?.trim() || null;
    const userId = filters.userId?.trim() || null;
    const monthKey = filters.monthKey?.trim() || null;
    const contextQuery = filters.contextQuery?.trim() || null;
    const contextPattern = contextQuery
        ? `%${escapeSurveyContextSearch(contextQuery)}%`
        : null;
    const contextEscapeCharacter = '\\';

    return and(
        eq(surveyResponses.surveyId, surveyId),
        inArray(surveyResponses.versionId, versionIds),
        filters.submittedFrom
            ? gte(surveyResponses.submittedAt, filters.submittedFrom)
            : undefined,
        filters.submittedTo
            ? lte(surveyResponses.submittedAt, filters.submittedTo)
            : undefined,
        accountId
            ? eq(resolvedSurveyResponseAccountId(), accountId)
            : undefined,
        userId ? eq(resolvedSurveyResponseUserId(), userId) : undefined,
        filters.source ? eq(surveyResponses.source, filters.source) : undefined,
        monthKey
            ? sql`${surveyAssignments.context}->>'monthKey' = ${monthKey}`
            : undefined,
        contextPattern
            ? or(
                  sql`${surveyAssignments.contextKey} ilike ${contextPattern} escape ${contextEscapeCharacter}`,
                  sql`${surveyAssignments.context}::text ilike ${contextPattern} escape ${contextEscapeCharacter}`,
                  sql`${surveyResponses.metadata}::text ilike ${contextPattern} escape ${contextEscapeCharacter}`,
              )
            : undefined,
    );
}

function sortSurveyQuestionsByVersion(
    questions: SelectSurveyQuestion[],
    versions: SelectSurveyVersion[],
) {
    const versionNumberById = new Map(
        versions.map((version) => [version.id, version.versionNumber]),
    );
    return [...questions].sort((left, right) => {
        const versionDifference =
            (versionNumberById.get(left.versionId) ?? 0) -
            (versionNumberById.get(right.versionId) ?? 0);
        if (versionDifference !== 0) return versionDifference;
        const orderDifference = left.sortOrder - right.sortOrder;
        return orderDifference !== 0
            ? orderDifference
            : left.id.localeCompare(right.id);
    });
}

type SurveyNumericAnswerRow = {
    questionId: string;
    numericValue: number | null;
    skipped: boolean;
    count: number;
};

function weightedMedian(
    rows: Array<{ count: number; value: number }>,
    totalCount: number,
) {
    if (totalCount === 0) return null;
    const sorted = [...rows].sort((left, right) => left.value - right.value);
    const valueAtRank = (rank: number) => {
        let seen = 0;
        for (const row of sorted) {
            seen += row.count;
            if (seen >= rank) return row.value;
        }
        return null;
    };
    const leftRank = Math.ceil(totalCount / 2);
    const rightRank = Math.floor(totalCount / 2) + 1;
    const left = valueAtRank(leftRank);
    const right = valueAtRank(rightRank);
    return left === null || right === null ? null : (left + right) / 2;
}

function buildNumericAggregatesFromRows(
    questions: SelectSurveyQuestion[],
    responseCountByVersion: ReadonlyMap<string, number>,
    answerRows: SurveyNumericAnswerRow[],
): SurveyNumericAggregate[] {
    const answersByQuestionId = new Map<string, SurveyNumericAnswerRow[]>();
    for (const answer of answerRows) {
        const existing = answersByQuestionId.get(answer.questionId) ?? [];
        existing.push(answer);
        answersByQuestionId.set(answer.questionId, existing);
    }

    return questions
        .filter((question) => question.type === 'opinion_scale')
        .map((question) => {
            const valueRows = (
                answersByQuestionId.get(question.id) ?? []
            ).flatMap((answer) =>
                !answer.skipped && answer.numericValue !== null
                    ? [
                          {
                              count: answer.count,
                              value: answer.numericValue,
                          },
                      ]
                    : [],
            );
            const distribution: Record<string, number> = {};
            let answeredCount = 0;
            let sum = 0;
            for (const row of valueRows) {
                answeredCount += row.count;
                sum += row.value * row.count;
                const key = row.value.toString();
                distribution[key] = (distribution[key] ?? 0) + row.count;
            }
            const versionResponseCount =
                responseCountByVersion.get(question.versionId) ?? 0;

            return {
                versionId: question.versionId,
                questionId: question.id,
                questionKey: question.key,
                title: question.title,
                count: answeredCount,
                unansweredCount: Math.max(
                    0,
                    versionResponseCount - answeredCount,
                ),
                average: answeredCount > 0 ? sum / answeredCount : null,
                median: weightedMedian(valueRows, answeredCount),
                distribution,
                scoreMetadata: question.scoreMetadata,
            };
        });
}

export async function getSurveyResponsePageAdmin({
    surveyId,
    page: requestedPage,
    pageSize: requestedPageSize,
    ...filters
}: SurveyResponsePageRequest): Promise<SurveyResponsePage | null> {
    const survey = await getSurveyById(surveyId);
    if (!survey) return null;

    const versions = await storage().query.surveyVersions.findMany({
        where: eq(surveyVersions.surveyId, surveyId),
        orderBy: desc(surveyVersions.versionNumber),
    });
    const requestedVersionId = filters.versionId?.trim() || null;
    const appliedVersionId =
        requestedVersionId &&
        versions.some((version) => version.id === requestedVersionId)
            ? requestedVersionId
            : null;
    const selectedVersionIds = appliedVersionId
        ? [appliedVersionId]
        : versions.map((version) => version.id);
    const pageSize = Math.min(
        maximumSurveyResponsePageSize,
        normalizePositiveInteger(
            requestedPageSize,
            defaultSurveyResponsePageSize,
        ),
    );
    if (selectedVersionIds.length === 0) {
        return {
            survey,
            versions,
            questions: [],
            responses: [],
            numericAggregates: [],
            totalCount: 0,
            page: 1,
            pageSize,
            pageCount: 0,
            appliedVersionId,
        };
    }

    const filtersWithAppliedVersion: SurveyResponseFilters = {
        ...filters,
        versionId: appliedVersionId,
    };
    const where = surveyResponseWhere({
        filters: filtersWithAppliedVersion,
        surveyId,
        versionIds: selectedVersionIds,
    });
    const [questionRows, countRows] = await Promise.all([
        storage().query.surveyQuestions.findMany({
            where: inArray(surveyQuestions.versionId, selectedVersionIds),
        }),
        storage()
            .select({
                versionId: surveyResponses.versionId,
                count: count(),
            })
            .from(surveyResponses)
            .leftJoin(
                surveyAssignments,
                and(
                    eq(surveyAssignments.id, surveyResponses.assignmentId),
                    eq(surveyAssignments.surveyId, surveyId),
                    eq(surveyAssignments.versionId, surveyResponses.versionId),
                ),
            )
            .where(where)
            .groupBy(surveyResponses.versionId),
    ]);
    const questions = sortSurveyQuestionsByVersion(questionRows, versions);
    const responseCountByVersion = new Map(
        countRows.map((row) => [row.versionId, row.count]),
    );
    const totalCount = countRows.reduce((total, row) => total + row.count, 0);
    const pageCount = Math.ceil(totalCount / pageSize);
    const normalizedPage = normalizePositiveInteger(requestedPage, 1);
    const page = pageCount > 0 ? Math.min(normalizedPage, pageCount) : 1;
    const resolvedAccountId = resolvedSurveyResponseAccountId();
    const resolvedUserId = resolvedSurveyResponseUserId();
    const numericQuestionIds = questions
        .filter((question) => question.type === 'opinion_scale')
        .map((question) => question.id);
    const [responseRows, numericAnswerRows] = await Promise.all([
        storage()
            .select({
                response: surveyResponses,
                assignment: surveyAssignments,
                version: surveyVersions,
                accountId: resolvedAccountId,
                userId: resolvedUserId,
                userName: users.userName,
                displayName: users.displayName,
            })
            .from(surveyResponses)
            .leftJoin(
                surveyAssignments,
                and(
                    eq(surveyAssignments.id, surveyResponses.assignmentId),
                    eq(surveyAssignments.surveyId, surveyId),
                    eq(surveyAssignments.versionId, surveyResponses.versionId),
                ),
            )
            .innerJoin(
                surveyVersions,
                and(
                    eq(surveyVersions.id, surveyResponses.versionId),
                    eq(surveyVersions.surveyId, surveyId),
                ),
            )
            .leftJoin(users, eq(users.id, resolvedUserId))
            .where(where)
            .orderBy(
                desc(surveyResponses.submittedAt),
                desc(surveyResponses.id),
            )
            .offset((page - 1) * pageSize)
            .limit(pageSize),
        numericQuestionIds.length > 0
            ? storage()
                  .select({
                      questionId: surveyAnswers.questionId,
                      numericValue: surveyAnswers.numericValue,
                      skipped: surveyAnswers.skipped,
                      count: count(),
                  })
                  .from(surveyResponses)
                  .leftJoin(
                      surveyAssignments,
                      and(
                          eq(
                              surveyAssignments.id,
                              surveyResponses.assignmentId,
                          ),
                          eq(surveyAssignments.surveyId, surveyId),
                          eq(
                              surveyAssignments.versionId,
                              surveyResponses.versionId,
                          ),
                      ),
                  )
                  .innerJoin(
                      surveyAnswers,
                      eq(surveyAnswers.responseId, surveyResponses.id),
                  )
                  .innerJoin(
                      surveyQuestions,
                      and(
                          eq(surveyQuestions.id, surveyAnswers.questionId),
                          eq(
                              surveyQuestions.versionId,
                              surveyResponses.versionId,
                          ),
                      ),
                  )
                  .where(
                      and(
                          where,
                          inArray(surveyAnswers.questionId, numericQuestionIds),
                      ),
                  )
                  .groupBy(
                      surveyAnswers.questionId,
                      surveyAnswers.numericValue,
                      surveyAnswers.skipped,
                  )
            : [],
    ]);
    const responseIds = responseRows.map((row) => row.response.id);
    const pageAnswerRows =
        responseIds.length > 0
            ? await storage()
                  .select({
                      answer: surveyAnswers,
                      question: surveyQuestions,
                  })
                  .from(surveyAnswers)
                  .innerJoin(
                      surveyResponses,
                      and(
                          eq(surveyResponses.id, surveyAnswers.responseId),
                          eq(surveyResponses.surveyId, surveyId),
                          inArray(surveyResponses.id, responseIds),
                      ),
                  )
                  .innerJoin(
                      surveyQuestions,
                      and(
                          eq(surveyQuestions.id, surveyAnswers.questionId),
                          eq(
                              surveyQuestions.versionId,
                              surveyResponses.versionId,
                          ),
                      ),
                  )
                  .orderBy(
                      asc(surveyQuestions.sortOrder),
                      asc(surveyAnswers.createdAt),
                      asc(surveyAnswers.id),
                  )
            : [];
    const answersByResponseId = new Map<string, SurveyResponseAnswerDetail[]>();
    for (const answer of pageAnswerRows) {
        const existing =
            answersByResponseId.get(answer.answer.responseId) ?? [];
        existing.push(answer);
        answersByResponseId.set(answer.answer.responseId, existing);
    }
    const responses = responseRows.map((row) => ({
        response: row.response,
        assignment: row.assignment,
        version: row.version,
        accountId: row.accountId,
        user:
            row.userId && row.userName
                ? {
                      id: row.userId,
                      userName: row.userName,
                      displayName: row.displayName,
                  }
                : null,
        answers: answersByResponseId.get(row.response.id) ?? [],
    }));

    return {
        survey,
        versions,
        questions,
        responses,
        numericAggregates: buildNumericAggregatesFromRows(
            questions,
            responseCountByVersion,
            numericAnswerRows,
        ),
        totalCount,
        page,
        pageSize,
        pageCount,
        appliedVersionId,
    };
}

export async function prepareSurveyResponseExportAdmin({
    surveyId,
    maximumResponseCount: requestedMaximumResponseCount,
    ...filters
}: SurveyResponseExportRequest): Promise<SurveyResponseExportPreparation | null> {
    const survey = await getSurveyById(surveyId);
    if (!survey) return null;

    const versions = await storage().query.surveyVersions.findMany({
        where: eq(surveyVersions.surveyId, surveyId),
        orderBy: desc(surveyVersions.versionNumber),
    });
    const requestedVersionId = filters.versionId?.trim() || null;
    const appliedVersionId =
        requestedVersionId &&
        versions.some((version) => version.id === requestedVersionId)
            ? requestedVersionId
            : null;
    const selectedVersionIds = appliedVersionId
        ? [appliedVersionId]
        : versions.map((version) => version.id);
    if (selectedVersionIds.length === 0) {
        return {
            status: 'ready',
            survey,
            versions,
            questions: [],
            responseIds: [],
            appliedVersionId,
        };
    }

    const maximumResponseCount = Math.min(
        maximumSurveyResponseExportCount,
        normalizePositiveInteger(
            requestedMaximumResponseCount,
            maximumSurveyResponseExportCount,
        ),
    );
    const where = surveyResponseWhere({
        surveyId,
        versionIds: selectedVersionIds,
        filters: {
            ...filters,
            versionId: appliedVersionId,
        },
    });
    const [questionRows, responseIdRows] = await Promise.all([
        storage().query.surveyQuestions.findMany({
            where: inArray(surveyQuestions.versionId, selectedVersionIds),
        }),
        storage()
            .select({ id: surveyResponses.id })
            .from(surveyResponses)
            .leftJoin(
                surveyAssignments,
                and(
                    eq(surveyAssignments.id, surveyResponses.assignmentId),
                    eq(surveyAssignments.surveyId, surveyId),
                    eq(surveyAssignments.versionId, surveyResponses.versionId),
                ),
            )
            .where(where)
            .orderBy(
                desc(surveyResponses.submittedAt),
                desc(surveyResponses.id),
            )
            .limit(maximumResponseCount + 1),
    ]);
    if (responseIdRows.length > maximumResponseCount) {
        return {
            status: 'too_large',
            reason: 'responses',
        };
    }

    return {
        status: 'ready',
        survey,
        versions,
        questions: sortSurveyQuestionsByVersion(questionRows, versions),
        responseIds: responseIdRows.map((row) => row.id),
        appliedVersionId,
    };
}

export async function getSurveyResponseExportBatchAdmin({
    responseIds,
    surveyId,
}: {
    responseIds: string[];
    surveyId: string;
}): Promise<SurveyResponseExportRow[]> {
    const orderedResponseIds = uniqueStrings(responseIds).slice(
        0,
        maximumSurveyResponseExportBatchSize,
    );
    if (orderedResponseIds.length === 0) return [];

    const resolvedAccountId = resolvedSurveyResponseAccountId();
    const resolvedUserId = resolvedSurveyResponseUserId();
    const responseRows = await storage()
        .select({
            response: surveyResponses,
            assignment: surveyAssignments,
            version: surveyVersions,
            accountId: resolvedAccountId,
            userId: resolvedUserId,
            userName: users.userName,
            displayName: users.displayName,
        })
        .from(surveyResponses)
        .leftJoin(
            surveyAssignments,
            and(
                eq(surveyAssignments.id, surveyResponses.assignmentId),
                eq(surveyAssignments.surveyId, surveyId),
                eq(surveyAssignments.versionId, surveyResponses.versionId),
            ),
        )
        .innerJoin(
            surveyVersions,
            and(
                eq(surveyVersions.id, surveyResponses.versionId),
                eq(surveyVersions.surveyId, surveyId),
            ),
        )
        .leftJoin(users, eq(users.id, resolvedUserId))
        .where(
            and(
                eq(surveyResponses.surveyId, surveyId),
                inArray(surveyResponses.id, orderedResponseIds),
            ),
        );
    const returnedResponseIds = responseRows.map((row) => row.response.id);
    const answerRows =
        returnedResponseIds.length > 0
            ? await storage()
                  .select({
                      answer: surveyAnswers,
                      question: surveyQuestions,
                  })
                  .from(surveyAnswers)
                  .innerJoin(
                      surveyResponses,
                      and(
                          eq(surveyResponses.id, surveyAnswers.responseId),
                          eq(surveyResponses.surveyId, surveyId),
                          inArray(surveyResponses.id, returnedResponseIds),
                      ),
                  )
                  .innerJoin(
                      surveyQuestions,
                      and(
                          eq(surveyQuestions.id, surveyAnswers.questionId),
                          eq(
                              surveyQuestions.versionId,
                              surveyResponses.versionId,
                          ),
                      ),
                  )
                  .orderBy(
                      asc(surveyQuestions.sortOrder),
                      asc(surveyAnswers.createdAt),
                      asc(surveyAnswers.id),
                  )
            : [];
    const answersByResponseId = new Map<string, SurveyResponseAnswerDetail[]>();
    for (const answer of answerRows) {
        const existing =
            answersByResponseId.get(answer.answer.responseId) ?? [];
        existing.push(answer);
        answersByResponseId.set(answer.answer.responseId, existing);
    }
    const rowByResponseId = new Map(
        responseRows.map((row) => [
            row.response.id,
            {
                response: row.response,
                assignment: row.assignment,
                version: row.version,
                accountId: row.accountId,
                user:
                    row.userId && row.userName
                        ? {
                              id: row.userId,
                              userName: row.userName,
                              displayName: row.displayName,
                          }
                        : null,
                answers: answersByResponseId.get(row.response.id) ?? [],
            },
        ]),
    );

    return orderedResponseIds.flatMap((responseId) => {
        const row = rowByResponseId.get(responseId);
        return row ? [row] : [];
    });
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
    const requestedVersionId = versionId?.trim() || null;
    const selectedVersionIds =
        requestedVersionId &&
        versions.some((version) => version.id === requestedVersionId)
            ? [requestedVersionId]
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

    const where = surveyResponseWhere({
        surveyId,
        versionIds: selectedVersionIds,
        filters: {
            submittedFrom: from,
            submittedTo: to,
            monthKey,
        },
    });
    const [questionRows, responseRows] = await Promise.all([
        storage().query.surveyQuestions.findMany({
            where: inArray(surveyQuestions.versionId, selectedVersionIds),
        }),
        storage()
            .select({
                response: surveyResponses,
                assignment: surveyAssignments,
            })
            .from(surveyResponses)
            .leftJoin(
                surveyAssignments,
                and(
                    eq(surveyAssignments.id, surveyResponses.assignmentId),
                    eq(surveyAssignments.surveyId, surveyId),
                    eq(surveyAssignments.versionId, surveyResponses.versionId),
                ),
            )
            .where(where)
            .orderBy(
                desc(surveyResponses.submittedAt),
                desc(surveyResponses.id),
            ),
    ]);
    const questions = sortSurveyQuestionsByVersion(questionRows, versions);
    const responseIds = responseRows.map((row) => row.response.id);
    const answerRows =
        responseIds.length > 0
            ? await storage().query.surveyAnswers.findMany({
                  where: inArray(surveyAnswers.responseId, responseIds),
                  orderBy: [
                      asc(surveyAnswers.createdAt),
                      asc(surveyAnswers.id),
                  ],
              })
            : [];
    const answersByResponseId = new Map<string, SelectSurveyAnswer[]>();
    for (const answer of answerRows) {
        const existing = answersByResponseId.get(answer.responseId) ?? [];
        existing.push(answer);
        answersByResponseId.set(answer.responseId, existing);
    }
    const responses = responseRows.map((row) => ({
        response: row.response,
        assignment: row.assignment,
        answers: answersByResponseId.get(row.response.id) ?? [],
    }));

    return {
        survey,
        versions,
        questions,
        responses,
        numericAggregates: buildNumericAggregates(questions, responses),
    };
}

export async function getSurveyResponseAdmin({
    responseId,
    surveyId,
}: {
    responseId: string;
    surveyId: string;
}): Promise<SurveyResponseDetail | null> {
    const resolvedAccountId = resolvedSurveyResponseAccountId();
    const resolvedUserId = resolvedSurveyResponseUserId();
    const row = (
        await storage()
            .select({
                response: surveyResponses,
                assignment: surveyAssignments,
                version: surveyVersions,
                accountId: resolvedAccountId,
                userId: resolvedUserId,
                userName: users.userName,
                displayName: users.displayName,
            })
            .from(surveyResponses)
            .leftJoin(
                surveyAssignments,
                and(
                    eq(surveyAssignments.id, surveyResponses.assignmentId),
                    eq(surveyAssignments.surveyId, surveyId),
                    eq(surveyAssignments.versionId, surveyResponses.versionId),
                ),
            )
            .innerJoin(
                surveyVersions,
                and(
                    eq(surveyVersions.id, surveyResponses.versionId),
                    eq(surveyVersions.surveyId, surveyId),
                ),
            )
            .leftJoin(users, eq(users.id, resolvedUserId))
            .where(
                and(
                    eq(surveyResponses.id, responseId),
                    eq(surveyResponses.surveyId, surveyId),
                ),
            )
            .limit(1)
    )[0];
    if (!row) return null;

    const answers = await storage()
        .select({
            answer: surveyAnswers,
            question: surveyQuestions,
        })
        .from(surveyAnswers)
        .innerJoin(
            surveyQuestions,
            and(
                eq(surveyQuestions.id, surveyAnswers.questionId),
                eq(surveyQuestions.versionId, row.response.versionId),
            ),
        )
        .where(eq(surveyAnswers.responseId, row.response.id))
        .orderBy(
            asc(surveyQuestions.sortOrder),
            asc(surveyAnswers.createdAt),
            asc(surveyAnswers.id),
        );

    return {
        response: row.response,
        assignment: row.assignment,
        version: row.version,
        accountId: row.accountId,
        user:
            row.userId && row.userName
                ? {
                      id: row.userId,
                      userName: row.userName,
                      displayName: row.displayName,
                  }
                : null,
        answers,
    };
}

export function buildNumericAggregates<
    T extends {
        response: SelectSurveyResponse;
        answers: Array<SurveyResponseAnswerDetail | SelectSurveyAnswer>;
    },
>(questions: SelectSurveyQuestion[], responses: T[]): SurveyNumericAggregate[] {
    const responseCountByVersion = new Map<string, number>();
    for (const response of responses) {
        responseCountByVersion.set(
            response.response.versionId,
            (responseCountByVersion.get(response.response.versionId) ?? 0) + 1,
        );
    }

    return buildNumericAggregatesFromRows(
        questions,
        responseCountByVersion,
        responses.flatMap((response) =>
            response.answers.map((item) => {
                const answer = 'answer' in item ? item.answer : item;
                return {
                    questionId: answer.questionId,
                    numericValue: answer.numericValue,
                    skipped: answer.skipped,
                    count: 1,
                };
            }),
        ),
    );
}

export async function getSurveyWorkspaceAdminDetails(surveyId: string) {
    const survey = await getSurveyById(surveyId);
    if (!survey) return null;
    const [versions, sends, assignments] = await Promise.all([
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
    };
}

export async function getSurveyAdminDetails(surveyId: string) {
    const [details, results] = await Promise.all([
        getSurveyWorkspaceAdminDetails(surveyId),
        getSurveyResultsAdmin({ surveyId }),
    ]);
    if (!details) return null;

    return {
        ...details,
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
