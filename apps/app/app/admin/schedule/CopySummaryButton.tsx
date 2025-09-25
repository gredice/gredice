'use client';

import { Duplicate } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Row } from '@signalco/ui-primitives/Row';
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
        <Row spacing={1}>
            <Button
                title="Kopiraj sažetak u međuspremnik"
                onClick={handleCopy}
                variant="plain"
                startDecorator={<Duplicate className="size-4 shrink-0" />}
                disabled={disabled}
            >
                Kopiraj sažetak
            </Button>
            {copied && (
                <span className="text-sm text-green-500">Kopirano!</span>
            )}
        </Row>
    );
}

export default CopySummaryButton;
