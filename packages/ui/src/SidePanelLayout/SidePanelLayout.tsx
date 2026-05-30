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
    /**
     * @deprecated No-op. Panels now always stay mounted so their width can
     * animate when collapsing/expanding; closed content is preserved by default.
     */
    preserveClosedPanels?: boolean;
    rightPanel?: ReactNode;
    rightOpen?: boolean;
    rightPanelClassName?: string;
    rightWidth?: string;
};

// Gap kept between a panel and the main content while the panel is open. It is
// baked into the open track width (and the panel's inner margin) so the gap can
// collapse together with the panel during the width animation.
const SIDE_PANEL_GAP = '1.5rem';

function sidePanelColumns({
    leftOpen,
    leftPanel,
    rightOpen,
    rightPanel,
}: Pick<
    SidePanelLayoutProps,
    'leftOpen' | 'leftPanel' | 'rightOpen' | 'rightPanel'
>) {
    // Closed panels keep a 0px track (instead of being removed) so that
    // grid-template-columns can animate between the panel width and 0.
    return [
        leftPanel
            ? leftOpen
                ? `calc(var(--side-panel-left-width) + ${SIDE_PANEL_GAP})`
                : '0px'
            : null,
        'minmax(0,1fr)',
        rightPanel
            ? rightOpen
                ? `calc(var(--side-panel-right-width) + ${SIDE_PANEL_GAP})`
                : '0px'
            : null,
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
        rightOpen,
        rightPanel,
    });
    const layoutStyle = {
        ...style,
        '--side-panel-layout-columns': columns,
        '--side-panel-left-width': leftWidth,
        '--side-panel-right-width': rightWidth,
    } as CSSProperties;
    // Panels stay mounted while closed so their width can animate; below the xl
    // breakpoint (stacked layout) closed panels are hidden instead.
    const basePanelClassName = cx(
        'h-fit min-w-0 xl:sticky xl:top-4 xl:overflow-hidden',
        panelClassName,
    );

    return (
        <div
            className={cx(
                'grid gap-6 xl:gap-0 xl:[grid-template-columns:var(--side-panel-layout-columns)]',
                'xl:transition-[grid-template-columns] xl:duration-300 xl:ease-in-out motion-reduce:xl:transition-none',
                className,
            )}
            style={layoutStyle}
            {...props}
        >
            {leftPanel ? (
                <aside
                    aria-hidden={!leftOpen || undefined}
                    className={cx(
                        basePanelClassName,
                        !leftOpen && 'hidden xl:block',
                        leftPanelClassName,
                    )}
                    data-side="left"
                    data-state={leftOpen ? 'open' : 'closed'}
                    inert={!leftOpen || undefined}
                >
                    <div className="xl:mr-6 xl:w-[var(--side-panel-left-width)]">
                        {leftPanel}
                    </div>
                </aside>
            ) : null}
            <div className="min-w-0">{children}</div>
            {rightPanel ? (
                <aside
                    aria-hidden={!rightOpen || undefined}
                    className={cx(
                        basePanelClassName,
                        !rightOpen && 'hidden xl:block',
                        rightPanelClassName,
                    )}
                    data-side="right"
                    data-state={rightOpen ? 'open' : 'closed'}
                    inert={!rightOpen || undefined}
                >
                    <div className="xl:ml-6 xl:w-[var(--side-panel-right-width)]">
                        {rightPanel}
                    </div>
                </aside>
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
