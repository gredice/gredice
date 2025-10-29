import { redirect } from 'next/navigation';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';

export const dynamic = 'force-dynamic';

export default async function SlackSettingsPage() {
    await auth(['admin']);

    redirect(`${KnownPages.Settings}#notification-settings`);
}
