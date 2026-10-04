'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Duplicate } from '@gredice/ui/icons';
import type { MouseEvent } from 'react';
import { useState } from 'react';

type CopySummaryButtonProps = {
    summaryText: string;
    disabled?: boolean;
};

export function CopySummaryButton({
    summaryText,
    disabled,
}: CopySummaryButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        if (disabled) {
            return;
        }

        try {
            await navigator.clipboard.writeText(summaryText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy summary to clipboard:', error);
        }
    };

    return (
        <>
            <IconButton
                title={copied ? 'Sažetak kopiran' : 'Kopiraj sažetak'}
                onClick={handleCopy}
                variant="plain"
                size="xs"
                color={copied ? 'success' : 'neutral'}
                disabled={disabled}
            >
                <Duplicate className="size-4 shrink-0" />
            </IconButton>
            <span className="sr-only" aria-live="polite">
                {copied ? 'Kopirano!' : ''}
            </span>
        </>
    );
}

export default CopySummaryButton;
