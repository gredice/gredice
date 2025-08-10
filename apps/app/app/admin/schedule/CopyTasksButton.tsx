'use client';

import { useState } from "react";
import { Duplicate } from "@signalco/ui-icons";
import { Row } from "@signalco/ui-primitives/Row";

type TaskItem = {
    id: string;
    text: string;
    link?: string;
};

type CopyTasksButtonProps = {
    physicalId: string;
    tasks: TaskItem[];
};

export function CopyTasksButton({ physicalId, tasks }: CopyTasksButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Create formatted text with links
        const taskText = tasks.map(task => {
            // TODO: Not working for WhatsApp
            // if (task.link) {
            //     return `• [${task.text}](${task.link})`;
            // }
            return `• ${task.text}`;
        }).join('\n');

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
            <a onClick={handleCopy} className="hover:opacity-60">
                <Duplicate className="size-4" />
            </a>
            {copied && <span className="text-sm text-green-500">Kopirano!</span>}
        </Row>
    );
}
