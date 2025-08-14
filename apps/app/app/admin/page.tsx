import { auth } from "../../lib/auth/auth";
import { AdminDashboard } from "../../components/admin/dashboard";

export const dynamic = 'force-dynamic';

export default async function AdminPage({
    searchParams
}: {
    searchParams: Promise<{ period?: string }>
}) {
    await auth(['admin']);
    return (
        <AdminDashboard searchParams={searchParams} />
    );
}