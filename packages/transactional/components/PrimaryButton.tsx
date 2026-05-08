import type { PropsWithChildren } from 'react';
import { Button } from 'react-email';

export function PrimaryButton({
    href,
    children,
}: PropsWithChildren<{ href: string }>) {
    return (
        <Button
            className="rounded-lg bg-[#166534] px-4 py-3 text-center text-[14px] font-semibold text-white no-underline"
            href={href}
        >
            {children}
        </Button>
    );
}
