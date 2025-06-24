import { NextRequest } from "next/server";
import { notificationsDigest } from "@gredice/storage";
import { sendNotificationsBulk } from "../../../../../lib/email/transactional";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', {
            status: 401,
        });
    }

    const notificationEmails = await notificationsDigest();
    for (const email of notificationEmails) {
        if (email.newNotificationsCount === 0 || !email.email) {
            console.debug(`Skipping email ${email.email} with no new notifications or email.`);
            continue;
        }

        await sendNotificationsBulk(email.email, {
            email: email.email,
            notificationsCount: email.newNotificationsCount,
        })
    }

    return Response.json({ success: true, emails: notificationEmails.length });
}