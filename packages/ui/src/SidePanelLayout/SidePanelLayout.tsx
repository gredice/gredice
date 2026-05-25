'use client';

import type {
    CSSProperties,
    HTMLAttributes,
    MouseEvent as ReactMouseEvent,
    ReactNode,
} from 'react';
import type { ButtonButtonProps } from '../Button';
import { IconButton } from '../IconButton';
import {
    PanelLeftClose,
    PanelLeftOpen,
    PanelRightClose,
    PanelRightOpen,
} from '../icons';
import { cx } from '../utils';

export type SidePanelSide = 'left' | 'right';

export type SidePanelLayoutProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    'children'
> & {
    children: ReactNode;
    leftPanel?: ReactNode;
    leftOpen?: boolean;
    leftPanelClassName?: string;
    leftWidth?: string;
    panelClassName?: string;
    preserveClosedPanels?: boolean;
    rightPanel?: ReactNode;
    rightOpen?: boolean;
    rightPanelClassName?: string;
    rightWidth?: string;
};

function sidePanelColumns({
    leftOpen,
    leftPanel,
    leftWidth,
    rightOpen,
    rightPanel,
    rightWidth,
}: Pick<
    SidePanelLayoutProps,
    | 'leftOpen'
    | 'leftPanel'
    | 'leftWidth'
    | 'rightOpen'
    | 'rightPanel'
    | 'rightWidth'
>) {
    return [
        leftPanel && leftOpen ? leftWidth : null,
        'minmax(0,1fr)',
        rightPanel && rightOpen ? rightWidth : null,
    ]
        .filter(Boolean)
        .join(' ');
}

export function SidePanelLayout({
    children,
    className,
    leftPanel,
    leftOpen = true,
    leftPanelClassName,
    leftWidth = '18rem',
    panelClassName,
    preserveClosedPanels,
    rightPanel,
    rightOpen = true,
    rightPanelClassName,
    rightWidth = '24rem',
    style,
    ...props
}: SidePanelLayoutProps) {
    const columns = sidePanelColumns({
        leftOpen,
        leftPanel,
        leftWidth,
        rightOpen,
        rightPanel,
        rightWidth,
    });
    const layoutStyle = {
        ...style,
        '--side-panel-layout-columns': columns,
    } as CSSProperties;
    const basePanelClassName = cx(
        'h-fit min-w-0 xl:sticky xl:top-4',
        panelClassName,
    );

    return (
        <div
            className={cx(
                'grid gap-6 xl:[grid-template-columns:var(--side-panel-layout-columns)]',
                className,
            )}
            style={layoutStyle}
            {...props}
        >
            {leftPanel && leftOpen ? (
                <aside
                    className={cx(basePanelClassName, leftPanelClassName)}
                    data-side="left"
                >
                    {leftPanel}
                </aside>
            ) : null}
            {leftPanel && !leftOpen && preserveClosedPanels ? (
                <div hidden>{leftPanel}</div>
            ) : null}
            <div className="min-w-0">{children}</div>
            {rightPanel && rightOpen ? (
                <aside
                    className={cx(basePanelClassName, rightPanelClassName)}
                    data-side="right"
                >
                    {rightPanel}
                </aside>
            ) : null}
            {rightPanel && !rightOpen && preserveClosedPanels ? (
                <div hidden>{rightPanel}</div>
            ) : null}
        </div>
    );
}

export type SidePanelToggleButtonProps = Omit<
    ButtonButtonProps,
    | 'aria-label'
    | 'aria-labelledby'
    | 'children'
    | 'endDecorator'
    | 'fullWidth'
    | 'startDecorator'
    | 'title'
> & {
    label: string;
    open: boolean;
    side: SidePanelSide;
    onOpenChange?: (open: boolean) => void;
};

export function SidePanelToggleButton({
    className,
    label,
    onClick,
    onOpenChange,
    open,
    side,
    size = 'sm',
    type = 'button',
    variant,
    ...props
}: SidePanelToggleButtonProps) {
    const action = open ? 'Sakrij' : 'Prikaži';
    const accessibleLabel = `${action} ${label}`;
    const Icon =
        side === 'left'
            ? open
                ? PanelLeftClose
                : PanelLeftOpen
            : open
              ? PanelRightClose
              : PanelRightOpen;
    const resolvedVariant = variant ?? (open ? 'soft' : 'plain');

    return (
        <IconButton
            aria-label={accessibleLabel}
            aria-pressed={open}
            className={cx(
                'shrink-0 rounded-full text-foreground hover:text-foreground',
                className,
            )}
            onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                onClick?.(event);
                if (!event.defaultPrevented) {
                    onOpenChange?.(!open);
                }
            }}
            size={size}
            title={accessibleLabel}
            type={type}
            variant={resolvedVariant}
            {...props}
        >
            <Icon className="size-4" />
        </IconButton>
    );
}
