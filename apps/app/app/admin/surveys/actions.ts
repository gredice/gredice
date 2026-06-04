'use server';

import { sendEmail } from '@gredice/email/acs';
import {
    archiveSurvey,
    createNotification,
    createSurveyDefinition,
    createSurveyDraftVersion,
    createSurveySend,
    getAccountUsers,
    getSurveyById,
    getUser,
    previewSurveyAudience,
    publishSurveyVersion,
    recordSurveySendDelivery,
    type SurveyAudiencePreview,
    type SurveyQuestionInput,
    type SurveyQuestionSettings,
    type SurveySendAudience,
    seedDeliverySatisfactionSurveyDefinition,
} from '@gredice/storage';
import MarkdownEmailTemplate from '@gredice/transactional/emails/markdown';
import { revalidatePath } from 'next/cache';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';

type ContactQuestionSettings = Extract<
    SurveyQuestionSettings,
    { type: 'contact_info' }
>;

const defaultContactFields = [
    'first_name',
    'last_name',
    'phone',
    'email',
] satisfies ContactQuestionSettings['fields'];

export type SurveyActionState = {
    success?: boolean;
    message?: string;
    surveyId?: string;
    versionId?: string;
};

export type SurveyPreviewActionState = SurveyActionState & {
    preview?: SurveyAudiencePreview;
};

function textField(formData: FormData, key: string) {
    const value = formData.get(key);
    return typeof value === 'string' ? value.trim() : '';
}

function boolField(formData: FormData, key: string) {
    return formData.get(key) === 'on' || formData.get(key) === 'true';
}

function splitIds(value: string) {
    return value
        .split(/[\s,]+/u)
        .map((item) => item.trim())
        .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function optionalStringValue(value: unknown) {
    const normalized = stringValue(value);
    return normalized || null;
}

function booleanValue(value: unknown) {
    return value === true || value === 'true';
}

function numberValue(value: unknown, fallback: number) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return fallback;
}

function parseQuestionSettings(
    type: SurveyQuestionInput['type'],
    value: unknown,
): SurveyQuestionSettings {
    const settings = isRecord(value) ? value : {};
    if (type === 'opinion_scale') {
        return {
            type: 'opinion_scale',
            min: numberValue(settings.min, 0),
            max: numberValue(settings.max, 10),
            step: numberValue(settings.step, 1),
            minLabel: optionalStringValue(settings.minLabel),
            maxLabel: optionalStringValue(settings.maxLabel),
        };
    }
    if (type === 'contact_info') {
        const fields: ContactQuestionSettings['fields'] = Array.isArray(
            settings.fields,
        )
            ? settings.fields
                  .map(stringValue)
                  .filter(
                      (
                          field,
                      ): field is
                          | 'first_name'
                          | 'last_name'
                          | 'phone'
                          | 'email' =>
                          field === 'first_name' ||
                          field === 'last_name' ||
                          field === 'phone' ||
                          field === 'email',
                  )
            : defaultContactFields;
        return {
            type: 'contact_info',
            fields: fields.length > 0 ? fields : ['email'],
            phoneDefaultCountry: optionalStringValue(
                settings.phoneDefaultCountry,
            ),
        };
    }
    return {
        type: 'long_text',
        maxLength: numberValue(settings.maxLength, 2000),
        placeholder: optionalStringValue(settings.placeholder),
    };
}

function parseQuestions(value: unknown): SurveyQuestionInput[] {
    if (!Array.isArray(value)) {
        throw new Error('Questions payload must be an array');
    }

    return value.map((item, index) => {
        if (!isRecord(item)) {
            throw new Error(`Question ${index + 1} is invalid`);
        }
        const type = stringValue(item.type);
        if (
            type !== 'opinion_scale' &&
            type !== 'long_text' &&
            type !== 'contact_info'
        ) {
            throw new Error(`Question ${index + 1} has an unsupported type`);
        }
        const scoreMetadata = isRecord(item.scoreMetadata)
            ? {
                  internalScore: booleanValue(item.scoreMetadata.internalScore),
                  publicScore: booleanValue(item.scoreMetadata.publicScore),
                  npsLike: booleanValue(item.scoreMetadata.npsLike),
              }
            : undefined;

        return {
            key: stringValue(item.key),
            title: stringValue(item.title),
            description: optionalStringValue(item.description),
            type,
            required: booleanValue(item.required),
            settings: parseQuestionSettings(type, item.settings),
            scoreMetadata,
        };
    });
}

function questionsFromForm(formData: FormData) {
    const raw = textField(formData, 'questionsJson');
    if (!raw) {
        throw new Error('Dodaj barem jedno pitanje.');
    }
    return parseQuestions(JSON.parse(raw));
}

export async function createSurveyDefinitionAction(
    _prevState: SurveyActionState,
    formData: FormData,
): Promise<SurveyActionState> {
    try {
        const { userId } = await auth(['admin']);
        const created = await createSurveyDefinition({
            key: textField(formData, 'key'),
            title: textField(formData, 'title'),
            description: textField(formData, 'description') || null,
            category: textField(formData, 'category') || 'general',
            introTitle: textField(formData, 'introTitle') || null,
            introDescription: textField(formData, 'introDescription') || null,
            thankYouTitle: textField(formData, 'thankYouTitle') || null,
            thankYouDescription:
                textField(formData, 'thankYouDescription') || null,
            createdByUserId: userId,
            questions: questionsFromForm(formData),
        });
        revalidatePath(KnownPages.Surveys);
        return {
            success: true,
            message: 'Anketa je spremljena kao nacrt.',
            surveyId: created.surveyId,
            versionId: created.versionId,
        };
    } catch (error) {
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Anketu nije moguće spremiti.',
        };
    }
}

export async function createSurveyDraftVersionAction(
    _prevState: SurveyActionState,
    formData: FormData,
): Promise<SurveyActionState> {
    try {
        await auth(['admin']);
        const surveyId = textField(formData, 'surveyId');
        const versionId = await createSurveyDraftVersion(surveyId, {
            title: textField(formData, 'title'),
            description: textField(formData, 'description') || null,
            introTitle: textField(formData, 'introTitle') || null,
            introDescription: textField(formData, 'introDescription') || null,
            thankYouTitle: textField(formData, 'thankYouTitle') || null,
            thankYouDescription:
                textField(formData, 'thankYouDescription') || null,
            questions: questionsFromForm(formData),
        });
        revalidatePath(KnownPages.Surveys);
        return {
            success: true,
            message: 'Nova verzija ankete je spremljena kao nacrt.',
            surveyId,
            versionId,
        };
    } catch (error) {
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Verziju nije moguće spremiti.',
        };
    }
}

export async function seedDeliverySatisfactionSurveyAction(formData: FormData) {
    const { userId } = await auth(['admin']);
    const publish = boolField(formData, 'publish');
    await seedDeliverySatisfactionSurveyDefinition({
        createdByUserId: userId,
        publish,
    });
    revalidatePath(KnownPages.Surveys);
}

export async function publishSurveyVersionAction(formData: FormData) {
    await auth(['admin']);
    const surveyId = textField(formData, 'surveyId');
    const versionId = textField(formData, 'versionId');
    await publishSurveyVersion({ surveyId, versionId });
    revalidatePath(KnownPages.Surveys);
}

export async function archiveSurveyAction(formData: FormData) {
    await auth(['admin']);
    await archiveSurvey(textField(formData, 'surveyId'));
    revalidatePath(KnownPages.Surveys);
}

function buildAudience(formData: FormData): SurveySendAudience {
    const targetType = textField(formData, 'targetType');
    const accountIds = splitIds(textField(formData, 'accountIds'));
    const userIds = splitIds(textField(formData, 'userIds'));

    if (targetType === 'accounts') {
        return { type: 'accounts', accountIds };
    }
    if (targetType === 'users') {
        return {
            type: 'users',
            userIds,
            accountIds: accountIds.length > 0 ? accountIds : undefined,
        };
    }

    const recipients: Array<{ accountId: string; userId?: string | null }> = [];
    for (const line of textField(formData, 'explicitRecipients').split(
        /\n+/u,
    )) {
        const [accountId, userId] = line
            .split(/[,\s]+/u)
            .map((item) => item.trim())
            .filter(Boolean);
        if (accountId) {
            recipients.push({ accountId, userId: userId ?? null });
        }
    }
    return { type: 'explicit', recipients };
}

export async function previewSurveyAudienceAction(
    _prevState: SurveyPreviewActionState,
    formData: FormData,
): Promise<SurveyPreviewActionState> {
    try {
        await auth(['admin']);
        const preview = await previewSurveyAudience(buildAudience(formData));
        return {
            success: true,
            message: `${preview.targetCount} primatelja, ${preview.accountCount} računa, ${preview.userCount} korisnika.`,
            preview,
        };
    } catch (error) {
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Publiku nije moguće pregledati.',
        };
    }
}

function gardenSurveyUrl(assignmentId: string) {
    const origin =
        process.env.GREDICE_GARDEN_APP_URL ??
        process.env.NEXT_PUBLIC_GREDICE_GARDEN_ORIGIN ??
        'https://vrt.gredice.com';
    return new URL(
        `/ankete/${encodeURIComponent(assignmentId)}`,
        origin,
    ).toString();
}

async function sendSurveyEmail({
    assignmentId,
    email,
    surveyTitle,
}: {
    assignmentId: string;
    email: string;
    surveyTitle: string;
}) {
    const surveyUrl = gardenSurveyUrl(assignmentId);
    await sendEmail({
        from: 'suncokret@obavijesti.gredice.com',
        to: email,
        subject: `Gredice - ${surveyTitle}`,
        template: MarkdownEmailTemplate({
            previewText: surveyTitle,
            content: [
                `# ${surveyTitle}`,
                '',
                'Voljeli bismo čuti tvoje dojmove. Kratku anketu možeš ispuniti unutar Gredica.',
                '',
                `[Ispuni anketu](${surveyUrl})`,
            ].join('\n'),
        }),
        templateName: 'survey-manual',
        messageType: 'survey',
        metadata: {
            surveyAssignmentId: assignmentId,
        },
    });
}

async function sendAssignmentNotifications({
    assignment,
    emailEnabled,
    inAppEnabled,
    surveyTitle,
}: {
    assignment: {
        id: string;
        accountId: string | null;
        userId: string | null;
    };
    emailEnabled: boolean;
    inAppEnabled: boolean;
    surveyTitle: string;
}) {
    if (!assignment.accountId) {
        return { emails: 0, notifications: 0, failures: 1 };
    }

    let emails = 0;
    let notifications = 0;
    let failures = 0;
    const url = gardenSurveyUrl(assignment.id);

    if (inAppEnabled) {
        try {
            const notificationId = await createNotification({
                accountId: assignment.accountId,
                userId: assignment.userId,
                header: `📋 ${surveyTitle}`,
                content:
                    'Ispuni kratku anketu i pomozi nam poboljšati Gredice.',
                linkUrl: url,
                actionUrl: url,
                actionLabel: 'Ispuni anketu',
                category: 'survey',
                type: 'survey_assignment',
                timestamp: new Date(),
                metadata: {
                    surveyAssignmentId: assignment.id,
                },
            });
            await recordSurveySendDelivery({
                assignmentId: assignment.id,
                channel: 'in_app',
                notificationId,
                status: 'sent',
            });
            notifications += 1;
        } catch (error) {
            await recordSurveySendDelivery({
                assignmentId: assignment.id,
                channel: 'in_app',
                status: 'failed',
                errorMessage:
                    error instanceof Error
                        ? error.message
                        : 'Notification failed',
            });
            failures += 1;
        }
    }

    if (emailEnabled) {
        const recipients = assignment.userId
            ? [await getUser(assignment.userId)]
            : (await getAccountUsers(assignment.accountId)).map(
                  (accountUser) => accountUser.user,
              );

        for (const recipient of recipients) {
            const email = recipient?.userName?.trim();
            if (!email) continue;
            try {
                await sendSurveyEmail({
                    assignmentId: assignment.id,
                    email,
                    surveyTitle,
                });
                await recordSurveySendDelivery({
                    assignmentId: assignment.id,
                    channel: 'email',
                    email,
                    status: 'sent',
                });
                emails += 1;
            } catch (error) {
                await recordSurveySendDelivery({
                    assignmentId: assignment.id,
                    channel: 'email',
                    email,
                    status: 'failed',
                    errorMessage:
                        error instanceof Error ? error.message : 'Email failed',
                });
                failures += 1;
            }
        }
    }

    return { emails, notifications, failures };
}

export async function sendSurveyAction(
    _prevState: SurveyActionState,
    formData: FormData,
): Promise<SurveyActionState> {
    try {
        const { accountId, userId } = await auth(['admin']);
        const surveyId = textField(formData, 'surveyId');
        const surveyKey = textField(formData, 'surveyKey') || undefined;
        const versionId = textField(formData, 'versionId') || undefined;
        const survey = surveyId ? await getSurveyById(surveyId) : null;
        const surveyTitle = survey?.title ?? 'Gredice anketa';
        const inApp = boolField(formData, 'inApp');
        const email = boolField(formData, 'email');
        const send = await createSurveySend({
            surveyId: surveyId || undefined,
            surveyKey,
            versionId,
            name: textField(formData, 'name') || surveyTitle,
            audience: buildAudience(formData),
            channelPolicy: { inApp, email },
            contextKey:
                textField(formData, 'contextKey') ||
                `manual:${surveyId || surveyKey || versionId}:${Date.now()}`,
            context: {
                sourceWorkflow: 'admin_manual_send',
            },
            createdByUserId: userId,
            createdFromAccountId: accountId,
        });

        let emails = 0;
        let notifications = 0;
        let failures = 0;
        for (const item of send.assignments) {
            if (item.duplicate) continue;
            const result = await sendAssignmentNotifications({
                assignment: item.assignment,
                emailEnabled: email,
                inAppEnabled: inApp,
                surveyTitle,
            });
            emails += result.emails;
            notifications += result.notifications;
            failures += result.failures;
        }

        revalidatePath(KnownPages.Surveys);
        return {
            success: true,
            message: `${send.createdCount} dodijeljeno, ${send.skippedDuplicateCount} preskočeno kao duplikat, ${notifications} obavijesti, ${emails} emailova, ${failures} grešaka.`,
            surveyId: send.send.surveyId,
        };
    } catch (error) {
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Slanje ankete nije uspjelo.',
        };
    }
}
