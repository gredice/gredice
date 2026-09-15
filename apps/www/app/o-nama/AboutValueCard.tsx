import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';

export function AboutValueCard({
    icon,
    title,
    description,
    microCopy,
}: {
    icon: ReactNode;
    title: string;
    description: string;
    microCopy: string;
}) {
    return (
        <Stack
            spacing={4}
            className="bg-card border border-tertiary border-b-4 rounded-xl p-6 shadow"
        >
            {icon}
            <Typography level="h5" component="h3">
                {title}
            </Typography>
            <Typography level="body1">{description}</Typography>
            <Typography
                level="body2"
                className="italic text-secondary-foreground"
            >
                {microCopy}
            </Typography>
        </Stack>
    );
}
