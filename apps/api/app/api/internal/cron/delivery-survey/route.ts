import { formatDeliveryCount } from '@gredice/js/i18n';
import {
    createNotification,
    createSurveySend,
    DELIVERY_SATISFACTION_SURVEY_KEY,
    DELIVERY_SATISFACTION_TYPEFORM_URL,
    type DeliverySurveyCandidate,
    ensureDeliverySatisfactionSurveyPublished,
    getDeliverySurveyCandidates,
    isTargetHourInTimeZone,
    markDeliverySurveySent,
    recordSurveySendDelivery,
} from '@gredice/storage';
import type { NextRequest } from 'next/server';
import { sendDeliverySurvey } from '../../../../../lib/email/transactional';

const LOOKBACK_DAYS = 45;
const TARGET_HOUR = 8; // Send survey at 8 AM user local time

export const dynamic = 'force-dynamic';

function getLookbackDate(days: number) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
}

function formatMonth(date: Date) {
    return new Intl.DateTimeFormat('hr-HR', {
        month: 'long',
        year: 'numeric',
    }).format(date);
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

function shouldUseTypeformFallback() {
    return process.env.GREDICE_DELIVERY_SURVEY_TYPEFORM_FALLBACK === 'true';
}

function fulfillmentPeriod(candidates: DeliverySurveyCandidate[]) {
    const sortedDates = candidates
        .map((candidate) => candidate.fulfilledAt)
        .sort((left, right) => left.getTime() - right.getTime());
    return {
        from: sortedDates[0]?.toISOString(),
        to: sortedDates.at(-1)?.toISOString(),
    };
}

interface DeliverySurveyGroup {
    accountId: string;
    accountTimeZone: string;
    fulfilledAt: Date;
    candidates: Map<string, DeliverySurveyCandidate>;
    monthKey: string;
}

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', {
            status: 401,
        });
    }

    const since = getLookbackDate(LOOKBACK_DAYS);
    const candidates = await getDeliverySurveyCandidates({ since });
    const typeformFallback = shouldUseTypeformFallback();
    if (!typeformFallback) {
        await ensureDeliverySatisfactionSurveyPublished();
    }

    let emailsSent = 0;
    let notificationsCreated = 0;
    let surveyAssignmentsCreated = 0;
    let surveyAssignmentsSkipped = 0;

    const groups = new Map<string, DeliverySurveyGroup>();
    const orderedGroups: DeliverySurveyGroup[] = [];

    const sentMonthGroups = new Set<string>();

    for (const candidate of candidates) {
        if (candidate.monthAlreadySent) {
            sentMonthGroups.add(`${candidate.accountId}:${candidate.monthKey}`);
        }

        const groupKey = `${candidate.accountId}:${candidate.monthKey}`;

        let group = groups.get(groupKey);
        if (!group) {
            group = {
                accountId: candidate.accountId,
                accountTimeZone: candidate.accountTimeZone,
                fulfilledAt: candidate.fulfilledAt,
                candidates: new Map<string, DeliverySurveyCandidate>(),
                monthKey: candidate.monthKey,
            };
            groups.set(groupKey, group);
            orderedGroups.push(group);
        }

        const existingCandidate = group.candidates.get(candidate.requestId);
        if (!existingCandidate) {
            group.candidates.set(candidate.requestId, candidate);
        } else if (candidate.fulfilledAt < existingCandidate.fulfilledAt) {
            group.candidates.set(candidate.requestId, candidate);
        }

        if (candidate.fulfilledAt < group.fulfilledAt) {
            group.fulfilledAt = candidate.fulfilledAt;
        }
    }

    // Filter groups to only process accounts where it's currently the target hour
    const now = new Date();
    const groupsToProcess = orderedGroups.filter((group) =>
        isTargetHourInTimeZone(group.accountTimeZone, TARGET_HOUR, now),
    );

    for (const group of groupsToProcess) {
        const candidatesInGroup = Array.from(group.candidates.values());
        if (candidatesInGroup.length === 0) {
            continue;
        }

        const formattedMonth = formatMonth(group.fulfilledAt);
        const requestIds = candidatesInGroup.map((item) => item.requestId);
        const operationIds = Array.from(
            new Set(candidatesInGroup.map((item) => item.operationId)),
        );
        const deliveryCountText = formatDeliveryCount(requestIds.length);

        const monthGroupKey = `${group.accountId}:${group.monthKey}`;

        if (sentMonthGroups.has(monthGroupKey)) {
            for (const candidate of candidatesInGroup) {
                await markDeliverySurveySent(candidate.requestId, []);
            }
            continue;
        }

        let surveyUrl = DELIVERY_SATISFACTION_TYPEFORM_URL;
        let assignmentId: string | null = null;

        if (!typeformFallback) {
            try {
                const send = await createSurveySend({
                    surveyKey: DELIVERY_SATISFACTION_SURVEY_KEY,
                    name: `Dostavna anketa ${formattedMonth}`,
                    audience: {
                        type: 'explicit',
                        recipients: [{ accountId: group.accountId }],
                    },
                    channelPolicy: {
                        inApp: true,
                        email: true,
                    },
                    contextKey: `delivery:${group.accountId}:${group.monthKey}`,
                    context: {
                        deliveryCount: requestIds.length,
                        deliveryRequestIds: requestIds,
                        fulfillmentPeriod: fulfillmentPeriod(candidatesInGroup),
                        monthKey: group.monthKey,
                        operationIds,
                        sourceWorkflow: 'delivery_survey_cron',
                    },
                    metadata: {
                        generatedBy: 'delivery-survey-cron',
                    },
                });
                surveyAssignmentsCreated += send.createdCount;
                surveyAssignmentsSkipped += send.skippedDuplicateCount;
                const assignment = send.assignments[0]?.assignment;
                if (!assignment) {
                    console.error(
                        'Delivery survey assignment was not created',
                        {
                            accountId: group.accountId,
                            monthKey: group.monthKey,
                            requestIds,
                        },
                    );
                    continue;
                }
                assignmentId = assignment.id;
                surveyUrl = gardenSurveyUrl(assignment.id);
            } catch (error) {
                console.error('Failed to create delivery survey assignment', {
                    accountId: group.accountId,
                    monthKey: group.monthKey,
                    requestIds,
                    error,
                });
                continue;
            }
        }

        const uniqueEmails = new Map<string, string>();

        for (const candidate of candidatesInGroup) {
            for (const user of candidate.userEmails) {
                const trimmedEmail = user.email.trim();
                const normalizedEmail = trimmedEmail.toLowerCase();

                if (
                    normalizedEmail.length === 0 ||
                    uniqueEmails.has(normalizedEmail)
                ) {
                    continue;
                }

                uniqueEmails.set(normalizedEmail, trimmedEmail);
            }
        }

        const sentEmails: string[] = [];

        for (const [normalizedEmail, email] of uniqueEmails) {
            try {
                await sendDeliverySurvey(email, {
                    email,
                    surveyUrl,
                    deliveryPeriod: formattedMonth,
                    deliveryCount: requestIds.length,
                });
                await recordSurveySendDelivery({
                    assignmentId,
                    channel: 'email',
                    email,
                    status: 'sent',
                    metadata: {
                        normalizedEmail,
                    },
                });
                sentEmails.push(normalizedEmail);
                emailsSent += 1;
            } catch (error) {
                await recordSurveySendDelivery({
                    assignmentId,
                    channel: 'email',
                    email,
                    status: 'failed',
                    errorMessage:
                        error instanceof Error ? error.message : 'Email failed',
                    metadata: {
                        normalizedEmail,
                    },
                });
                console.error('Failed to send delivery survey email', {
                    requestIds,
                    email,
                    error,
                });
            }
        }

        let notificationSuccess = false;

        try {
            const notificationId = await createNotification({
                accountId: group.accountId,
                header: `📣 Kako su ti se svidjele dostave u ${formattedMonth}?`,
                content: `U ${formattedMonth} imali smo ${deliveryCountText}. Podijeli svoje dojmove i ispuni kratku anketu 📋⭐️⭐️⭐️⭐️⭐️`,
                linkUrl: surveyUrl,
                actionUrl: surveyUrl,
                actionLabel: 'Ispuni anketu',
                category: 'survey',
                type: 'delivery_satisfaction_survey',
                timestamp: new Date(),
                metadata: {
                    surveyAssignmentId: assignmentId,
                    deliveryRequestIds: requestIds,
                    monthKey: group.monthKey,
                },
            });
            await recordSurveySendDelivery({
                assignmentId,
                channel: 'in_app',
                notificationId,
                status: 'sent',
            });
            notificationSuccess = true;
            notificationsCreated += 1;
        } catch (error) {
            await recordSurveySendDelivery({
                assignmentId,
                channel: 'in_app',
                status: 'failed',
                errorMessage:
                    error instanceof Error
                        ? error.message
                        : 'Notification failed',
            });
            console.error('Failed to create delivery survey notification', {
                requestIds,
                error,
            });
        }

        if (notificationSuccess || sentEmails.length > 0) {
            const sentEmailsList = [...sentEmails];
            for (const candidate of candidatesInGroup) {
                await markDeliverySurveySent(
                    candidate.requestId,
                    sentEmailsList,
                );
            }
            sentMonthGroups.add(monthGroupKey);
        }
    }

    return Response.json({
        success: true,
        deliveries: candidates.length,
        emailsSent,
        notificationsCreated,
        surveyAssignmentsCreated,
        surveyAssignmentsSkipped,
        typeformFallback,
        timestamp: new Date().toISOString(),
    });
}
