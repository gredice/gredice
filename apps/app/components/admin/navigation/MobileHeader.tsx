import { Row } from '@gredice/ui/Row';
import { AdminPageBreadcrumbs } from './AdminPageBreadcrumbs';
import { adminBreadcrumbClassName } from './adminBreadcrumbStyles';
import { MobileNav } from './MobileNav';

export function MobileHeader() {
    return (
        <div className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur md:hidden">
            <div className="flex h-14 items-center px-4">
                <Row spacing={6} className="w-full items-center">
                    <MobileNav />
                    <div
                        className={`min-w-0 flex-1 overflow-hidden ${adminBreadcrumbClassName}`}
                    >
                        <AdminPageBreadcrumbs />
                    </div>
                </Row>
            </div>
        </div>
    );
}
