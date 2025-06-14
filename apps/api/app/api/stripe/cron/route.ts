import { getStripeCheckoutSessions } from "@gredice/stripe/server";
import { NextRequest } from "next/server";
import { processCheckoutSession } from "../../../../lib/stripe/processCheckoutSession";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', {
            status: 401,
        });
    }

    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 3);
    const checkoutSessions = await getStripeCheckoutSessions(yesterday);
    await Promise.all(checkoutSessions.map(s => s.id).map(processCheckoutSession));
    return Response.json({ success: true, processedCheckoutSessions: checkoutSessions.length });
}