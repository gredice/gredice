import {
    createNotification,
    type DeliverySurveyCandidate,
    getDeliverySurveyCandidates,
    markDeliverySurveySent,
} from '@gredice/storage';
import type { NextRequest } from 'next/server';
import { sendDeliverySurvey } from '../../../../../lib/email/transactional';

const SURVEY_URL = 'https://form.typeform.com/to/X727vyBk';
const LOOKBACK_DAYS = 45;

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

function formatDeliveryCount(count: number) {
    if (count === 1) {
        return '1 dostava';
    }

    if (count >= 2 && count <= 4) {
        return `${count} dostave`;
    }

    return `${count} dostava`;
}

interface DeliverySurveyGroup {
    accountId: string;
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

    let emailsSent = 0;
    let notificationsCreated = 0;

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

    for (const group of orderedGroups) {
        const candidatesInGroup = Array.from(group.candidates.values());
        if (candidatesInGroup.length === 0) {
            continue;
        }

        const formattedMonth = formatMonth(group.fulfilledAt);
        const requestIds = candidatesInGroup.map((item) => item.requestId);
        const deliveryCountText = formatDeliveryCount(requestIds.length);

        const monthGroupKey = `${group.accountId}:${group.monthKey}`;

        if (sentMonthGroups.has(monthGroupKey)) {
            for (const candidate of candidatesInGroup) {
                await markDeliverySurveySent(candidate.requestId, []);
            }
            sentMonthGroups.add(monthGroupKey);
            continue;
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
                    surveyUrl: SURVEY_URL,
                    deliveryPeriod: formattedMonth,
                    deliveryCount: requestIds.length,
                });
                sentEmails.push(normalizedEmail);
                emailsSent += 1;
            } catch (error) {
                console.error('Failed to send delivery survey email', {
                    requestIds,
                    email,
                    error,
                });
            }
        }

        let notificationSuccess = false;

        try {
            await createNotification({
                accountId: group.accountId,
                header: `📣 Kako ti se svidjele dostave u ${formattedMonth}?`,
                content: `U ${formattedMonth} smo imali ${deliveryCountText}. Podijeli svoje dojmove i ispuni kratku anketu 📋⭐️⭐️⭐️⭐️⭐️`,
                linkUrl: SURVEY_URL,
                timestamp: new Date(),
            });
            notificationSuccess = true;
            notificationsCreated += 1;
        } catch (error) {
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
        timestamp: new Date().toISOString(),
    });
}
