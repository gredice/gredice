import {
    createNotification,
    getDeliverySurveyCandidates,
    markDeliverySurveySent,
} from '@gredice/storage';
import type { NextRequest } from 'next/server';
import { sendDeliverySurvey } from '../../../../../lib/email/transactional';

const SURVEY_URL = 'https://form.typeform.com/to/X727vyBk';
const LOOKBACK_DAYS = 7;

export const dynamic = 'force-dynamic';

function getLookbackDate(days: number) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
}

function formatDate(date: Date) {
    return new Intl.DateTimeFormat('hr-HR', {
        dateStyle: 'long',
    }).format(date);
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

    for (const candidate of candidates) {
        const formattedDate = formatDate(candidate.fulfilledAt);

        const sentEmails: string[] = [];
        const seenEmails = new Set<string>();

        for (const user of candidate.userEmails) {
            const normalizedEmail = user.email.trim().toLowerCase();
            if (normalizedEmail.length === 0) {
                continue;
            }

            if (seenEmails.has(normalizedEmail)) {
                continue;
            }

            seenEmails.add(normalizedEmail);

            try {
                await sendDeliverySurvey(user.email, {
                    email: user.email,
                    surveyUrl: SURVEY_URL,
                    deliveryDate: formattedDate,
                });
                sentEmails.push(user.email);
                emailsSent += 1;
            } catch (error) {
                console.error('Failed to send delivery survey email', {
                    requestId: candidate.requestId,
                    email: user.email,
                    error,
                });
            }
        }

        let notificationSuccess = false;

        try {
            await createNotification({
                accountId: candidate.accountId,
                header: 'Kako ti se svidjela dostava?',
                content: `Tvoja dostava je stigla ${formattedDate}. Podijeli svoje dojmove i ispuni kratku anketu.`,
                linkUrl: SURVEY_URL,
                timestamp: new Date(),
            });
            notificationSuccess = true;
            notificationsCreated += 1;
        } catch (error) {
            console.error('Failed to create delivery survey notification', {
                requestId: candidate.requestId,
                error,
            });
        }

        if (notificationSuccess || sentEmails.length > 0) {
            await markDeliverySurveySent(candidate.requestId, sentEmails);
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
