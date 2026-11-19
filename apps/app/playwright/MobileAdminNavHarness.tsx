import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { useEffect } from 'react';
import { prepareReview } from '../../../packages/ui/src/UierReview/reviewStore';
import { MobileNav } from '../components/admin/navigation/MobileNav';

export function MobileAdminNavHarness() {
    useEffect(() => {
        prepareReview('app', 'component-test');
    }, []);
    return (
        <PathnameContext.Provider value="/admin">
            <MobileNav />
            <input aria-label="Polje iza izbornika" />
        </PathnameContext.Provider>
    );
}
