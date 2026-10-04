'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Duplicate } from '@gredice/ui/icons';
import { useState } from 'react';

type TaskItem = {
    id: string;
    text: string;
    link?: string;
    approved?: boolean;
};

type CopyTasksButtonProps = {
    physicalId: string;
    tasks: TaskItem[];
};

export function CopyTasksButton({ physicalId, tasks }: CopyTasksButtonProps) {
    const [copied, setCopied] = useState(false);
    const approvedTasks = tasks.filter((task) => task.approved ?? true);

    const handleCopy = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (approvedTasks.length === 0) {
            return;
        }

        // Create formatted text with links
        const taskText = approvedTasks
            .map((task) => {
                // TODO: Not working for WhatsApp
                // if (task.link) {
                //     return `• [${task.text}](${task.link})`;
                // }
                return `• ${task.text}`;
            })
            .join('\n');

        const fullText = `Gr ${physicalId}\n${taskText}`;

        try {
            await navigator.clipboard.writeText(fullText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
        }
    };

    return (
        <>
            <IconButton
                title={copied ? 'Zadaci kopirani' : 'Kopiraj zadatke'}
                onClick={handleCopy}
                variant="plain"
                size="xs"
                color={copied ? 'success' : 'neutral'}
                disabled={approvedTasks.length === 0}
            >
                <Duplicate className="size-4 shrink-0" />
            </IconButton>
            <span className="sr-only" aria-live="polite">
                {copied ? 'Kopirano!' : ''}
            </span>
        </>
    );
}
