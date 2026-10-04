import type {
    ComponentType,
    PointerEvent,
    PropsWithChildren,
    ReactNode,
} from 'react';
import { useState } from 'react';
import { Card } from '../Card';
import { Divider } from '../Divider';
import { IconButton } from '../IconButton';
import { Down, Drag, Up } from '../icons';
import { Stack } from '../Stack';
import { Typography } from '../Typography';
import { cx } from '../utils';

type IconType = ComponentType<{ className?: string }>;

interface DebugPanelProps extends PropsWithChildren {
    title: string;
    description?: string;
    className?: string;
    dragging?: boolean;
    /** Collapse the panel on first render to keep the in-game footprint small. */
    defaultCollapsed?: boolean;
    /** Rendered to the right of the title while collapsed (e.g. live FPS). */
    collapsedSummary?: ReactNode;
    onDragHandlePointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
}

export function DebugPanel({
    title,
    description,
    className,
    dragging = false,
    defaultCollapsed = false,
    collapsedSummary,
    onDragHandlePointerDown,
    children,
}: DebugPanelProps) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);
    const draggable = Boolean(onDragHandlePointerDown);

    return (
        <Card
            className={cx(
                'flex max-h-[calc(100dvh-2rem)] w-full max-w-xs flex-col overflow-hidden border border-border/40 bg-background/95 p-0 shadow-lg backdrop-blur',
                className,
            )}
        >
            <div
                className={cx(
                    'flex shrink-0 items-center gap-1.5 px-2 py-1',
                    draggable
                        ? 'cursor-grab touch-none select-none active:cursor-grabbing'
                        : undefined,
                    dragging ? 'cursor-grabbing' : undefined,
                )}
                onPointerDown={onDragHandlePointerDown}
            >
                {draggable ? (
                    <Drag className="size-3.5 shrink-0 text-muted-foreground" />
                ) : null}
                <Typography
                    level="body2"
                    semiBold
                    className="shrink-0 leading-none"
                >
                    {title}
                </Typography>
                {collapsed && collapsedSummary ? (
                    <div className="ml-1 min-w-0 flex-1 truncate text-right font-mono text-[11px] leading-none text-muted-foreground">
                        {collapsedSummary}
                    </div>
                ) : (
                    <div className="flex-1" />
                )}
                <IconButton
                    type="button"
                    size="sm"
                    variant="plain"
                    title={collapsed ? 'Expand' : 'Collapse'}
                    className="-my-1 size-6 shrink-0 rounded-full"
                    onClick={() => setCollapsed((current) => !current)}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    {collapsed ? (
                        <Down className="size-3.5" />
                    ) : (
                        <Up className="size-3.5" />
                    )}
                </IconButton>
            </div>
            {collapsed ? null : (
                <>
                    <Divider />
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-2">
                        {description ? (
                            <Typography level="body3" secondary>
                                {description}
                            </Typography>
                        ) : null}
                        {children}
                    </div>
                </>
            )}
        </Card>
    );
}

interface DebugPanelSectionProps extends PropsWithChildren {
    title: string;
    description?: string;
    className?: string;
    icon?: IconType;
    /** Rendered to the left of the collapse toggle (e.g. a reset action). */
    action?: ReactNode;
}

export function DebugPanelSection({
    title,
    description,
    className,
    icon: Icon,
    action,
    children,
}: DebugPanelSectionProps) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <Stack
            spacing={2}
            className={cx(
                'rounded-md border border-border/40 bg-background/80 p-2 shadow-xs backdrop-blur-xs',
                className,
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                    {Icon ? (
                        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : null}
                    <Typography
                        level="body3"
                        semiBold
                        uppercase
                        className="truncate tracking-wide"
                    >
                        {title}
                    </Typography>
                </div>
                <div className="-my-1 -mr-1 flex shrink-0 items-center gap-0.5">
                    {!collapsed && action ? action : null}
                    <IconButton
                        type="button"
                        size="sm"
                        variant="plain"
                        title={collapsed ? 'Expand' : 'Collapse'}
                        className="size-6 shrink-0 rounded-full"
                        onClick={() => setCollapsed((current) => !current)}
                    >
                        {collapsed ? (
                            <Down className="size-3.5" />
                        ) : (
                            <Up className="size-3.5" />
                        )}
                    </IconButton>
                </div>
            </div>
            {!collapsed && description ? (
                <Typography level="body3" secondary>
                    {description}
                </Typography>
            ) : null}
            {collapsed ? null : children}
        </Stack>
    );
}
