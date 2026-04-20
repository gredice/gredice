import { Row } from '@signalco/ui-primitives/Row';
import { AdminPageBreadcrumbs } from './AdminPageBreadcrumbs';
import { MobileNav } from './MobileNav';

export function MobileHeader() {
    return (
        <div className="md:hidden sticky top-0 z-50 w-full">
            <div className="flex h-14 items-center px-4">
                <Row spacing={3} className="w-full items-center">
                    <MobileNav />
                    <div className="min-w-0 flex-1 overflow-hidden">
                        <AdminPageBreadcrumbs />
                    </div>
                </Row>
            </div>
        </div>
    );
}
