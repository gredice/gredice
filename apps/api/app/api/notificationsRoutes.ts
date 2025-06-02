import { NextRequest, NextResponse } from 'next/server';
import { createNotification, getNotificationsByUser, markNotificationRead } from 'packages/storage/src/repositories/notificationsRepo';

// GET /api/notifications?userId=...&read=...
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const read = searchParams.get('read');
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    const notifications = await getNotificationsByUser(userId, read === null ? undefined : read === 'true');
    return NextResponse.json(notifications);
}

// POST /api/notifications
export async function POST(req: NextRequest) {
    const data = await req.json();
    const notification = await createNotification(data);
    return NextResponse.json(notification);
}

// PATCH /api/notifications/:id/read
export async function PATCH(req: NextRequest) {
    const { id, readWhere } = await req.json();
    if (!id || !readWhere) return NextResponse.json({ error: 'Missing id or readWhere' }, { status: 400 });
    await markNotificationRead(id, readWhere);
    return NextResponse.json({ success: true });
}
