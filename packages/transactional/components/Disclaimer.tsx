import { Text } from '@react-email/components';
import type { PropsWithChildren } from 'react';

export function Disclaimer({
    children,
    className,
}: PropsWithChildren<{ className?: string }>) {
    return (
        <Text
            className={`${className ?? ''} text-[12px] leading-[24px] text-tertiary-foreground`}
        >
            {children}
        </Text>
    );
}
