'use client';

import { Duplicate } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Row } from '@signalco/ui-primitives/Row';
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
        <Row spacing={1}>
            <Button
                title="Kopiraj zadatke u međuspremnik"
                onClick={handleCopy}
                variant="plain"
                disabled={approvedTasks.length === 0}
                startDecorator={<Duplicate className="size-4 shrink-0" />}
            >
                Kopiraj zadatke
            </Button>
            {copied && (
                <span className="text-sm text-green-500">Kopirano!</span>
            )}
        </Row>
    );
}
