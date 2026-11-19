import { useAdminPageHeaderContext } from '../components/admin/navigation/AdminPageHeaderContext';

export function AdminDashboardHeaderSlot() {
    const { setSlotElement } = useAdminPageHeaderContext();
    return (
        <div
            className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2"
            data-testid="admin-page-header-slot"
            ref={setSlotElement}
        />
    );
}
