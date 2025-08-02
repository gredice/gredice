import { auth } from "../../lib/auth/auth";
import { AdminDashboard } from "./AdminDashboard";

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
    await auth(['admin']);
    return (
        <AdminDashboard />
    );
}