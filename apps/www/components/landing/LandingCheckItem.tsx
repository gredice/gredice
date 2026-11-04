import { Check } from '@gredice/ui/icons';
import type { ReactNode } from 'react';

export function LandingCheckItem({ children }: { children: ReactNode }) {
    return (
        <li className="flex gap-2.5">
            <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
            <span className="text-pretty">{children}</span>
        </li>
    );
}
