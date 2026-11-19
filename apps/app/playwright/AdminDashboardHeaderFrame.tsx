import type { ReactNode } from 'react';
import { AdminPageHeaderProvider } from '../components/admin/navigation/AdminPageHeaderProvider';
import { AdminDashboardHeaderSlot } from './AdminDashboardHeaderSlot';

export function AdminDashboardHeaderFrame({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <AdminPageHeaderProvider>
            <AdminDashboardHeaderSlot />
            {children}
        </AdminPageHeaderProvider>
    );
}
