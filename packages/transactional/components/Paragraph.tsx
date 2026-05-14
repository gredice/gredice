import type { PropsWithChildren } from 'react';
import { Text } from 'react-email';

export function Paragraph({
    children,
    className,
}: PropsWithChildren<{ className?: string }>) {
    return (
        <Text
            className={`text-[14px] leading-[24px] text-black ${className ?? ''}`}
        >
            {children}
        </Text>
    );
}
