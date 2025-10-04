import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { cx } from '@signalco/ui-primitives/cx';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { PointerEvent, PropsWithChildren } from 'react';

interface DebugPanelProps extends PropsWithChildren {
    title: string;
    description?: string;
    className?: string;
    dragging?: boolean;
    onDragHandlePointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
}

export function DebugPanel({
    title,
    description,
    className,
    dragging = false,
    onDragHandlePointerDown,
    children,
}: DebugPanelProps) {
    return (
        <Card
            className={cx(
                'w-full max-w-sm border border-border/40 bg-background/95 shadow-lg backdrop-blur',
                className,
            )}
        >
            <CardHeader
                className={cx(
                    'space-y-1',
                    onDragHandlePointerDown
                        ? 'cursor-grab select-none touch-none active:cursor-grabbing'
                        : undefined,
                    dragging ? 'cursor-grabbing' : undefined,
                )}
                onPointerDown={onDragHandlePointerDown}
            >
                <CardTitle className="text-base font-semibold">
                    {title}
                </CardTitle>
                {description ? (
                    <Typography level="body3" secondary>
                        {description}
                    </Typography>
                ) : null}
            </CardHeader>
            <CardContent noHeader className="space-y-3">
                {children}
            </CardContent>
        </Card>
    );
}

interface DebugPanelSectionProps extends PropsWithChildren {
    title: string;
    description?: string;
    className?: string;
}

export function DebugPanelSection({
    title,
    description,
    className,
    children,
}: DebugPanelSectionProps) {
    return (
        <Stack
            spacing={1.5}
            className={cx(
                'rounded-lg border border-border/40 bg-background/80 p-3 shadow-sm backdrop-blur-sm',
                className,
            )}
        >
            <div className="space-y-1">
                <Typography level="body2" semiBold>
                    {title}
                </Typography>
                {description ? (
                    <Typography level="body3" secondary>
                        {description}
                    </Typography>
                ) : null}
            </div>
            {children}
        </Stack>
    );
}
