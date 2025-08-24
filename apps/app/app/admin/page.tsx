import { AdminDashboard } from '../../components/admin/dashboard';
import { auth } from '../../lib/auth/auth';

export const dynamic = 'force-dynamic';

export default async function AdminPage({
    searchParams,
}: {
    searchParams: Promise<{ period?: string }>;
}) {
    await auth(['admin']);
    return <AdminDashboard searchParams={searchParams} />;
}
