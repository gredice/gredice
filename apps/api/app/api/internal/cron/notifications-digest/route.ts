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
    await Promise.all(notificationEmails.map(n => sendNotificationsBulk(n.email, {
        email: n.email,
        notificationsCount: n.newNotificationsCount,
    })));

    return Response.json({ success: true, emails: notificationEmails.length });
}