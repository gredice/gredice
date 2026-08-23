import type { ReactNode } from 'react';

export default function PlantsLayout({ children }: { children: ReactNode }) {
    return (
        <>
            <style>{'@view-transition { navigation: auto; }'}</style>
            {children}
        </>
    );
}
