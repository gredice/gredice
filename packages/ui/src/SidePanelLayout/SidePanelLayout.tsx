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
export type SidePanelLayoutBreakpoint = 'md' | 'lg' | 'xl';

export type SidePanelLayoutProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    'children'
> & {
    children: ReactNode;
    leftPanel?: ReactNode;
    leftOpen?: boolean;
    leftPanelClassName?: string;
    leftWidth?: string;
    /**
     * Breakpoint where panels become side columns instead of stacked content.
     */
    desktopBreakpoint?: SidePanelLayoutBreakpoint;
    /**
     * Keep closed stacked panels mounted when callers animate them manually.
     */
    hideClosedPanelsOnStack?: boolean;
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

const breakpointClasses: Record<
    SidePanelLayoutBreakpoint,
    {
        closedPanel: string;
        leftPanelInner: string;
        layout: string;
        panel: string;
        rightPanelInner: string;
    }
> = {
    md: {
        closedPanel: 'hidden md:block',
        leftPanelInner: 'md:mr-6 md:w-[var(--side-panel-left-width)]',
        layout: 'md:gap-0 md:[grid-template-columns:var(--side-panel-layout-columns)] md:transition-[grid-template-columns] md:duration-300 md:ease-in-out motion-reduce:md:transition-none',
        panel: 'md:sticky md:top-4 md:overflow-hidden',
        rightPanelInner: 'md:ml-6 md:w-[var(--side-panel-right-width)]',
    },
    lg: {
        closedPanel: 'hidden lg:block',
        leftPanelInner: 'lg:mr-6 lg:w-[var(--side-panel-left-width)]',
        layout: 'lg:gap-0 lg:[grid-template-columns:var(--side-panel-layout-columns)] lg:transition-[grid-template-columns] lg:duration-300 lg:ease-in-out motion-reduce:lg:transition-none',
        panel: 'lg:sticky lg:top-4 lg:overflow-hidden',
        rightPanelInner: 'lg:ml-6 lg:w-[var(--side-panel-right-width)]',
    },
    xl: {
        closedPanel: 'hidden xl:block',
        leftPanelInner: 'xl:mr-6 xl:w-[var(--side-panel-left-width)]',
        layout: 'xl:gap-0 xl:[grid-template-columns:var(--side-panel-layout-columns)] xl:transition-[grid-template-columns] xl:duration-300 xl:ease-in-out motion-reduce:xl:transition-none',
        panel: 'xl:sticky xl:top-4 xl:overflow-hidden',
        rightPanelInner: 'xl:ml-6 xl:w-[var(--side-panel-right-width)]',
    },
};

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
    desktopBreakpoint = 'xl',
    hideClosedPanelsOnStack = true,
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
    const responsiveClasses = breakpointClasses[desktopBreakpoint];
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
    // Panels stay mounted while closed so their width can animate; below the
    // configured breakpoint (stacked layout) closed panels are hidden by default.
    const basePanelClassName = cx(
        'min-w-0 self-start',
        responsiveClasses.panel,
        panelClassName,
    );
    const closedPanelClassName = hideClosedPanelsOnStack
        ? responsiveClasses.closedPanel
        : null;

    return (
        <div
            className={cx('grid gap-6', responsiveClasses.layout, className)}
            style={layoutStyle}
            {...props}
        >
            {leftPanel ? (
                <aside
                    aria-hidden={!leftOpen || undefined}
                    className={cx(
                        basePanelClassName,
                        !leftOpen && closedPanelClassName,
                        leftPanelClassName,
                    )}
                    data-side="left"
                    data-state={leftOpen ? 'open' : 'closed'}
                    inert={!leftOpen || undefined}
                >
                    <div
                        className={cx(
                            'h-full',
                            responsiveClasses.leftPanelInner,
                        )}
                    >
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
                        !rightOpen && closedPanelClassName,
                        rightPanelClassName,
                    )}
                    data-side="right"
                    data-state={rightOpen ? 'open' : 'closed'}
                    inert={!rightOpen || undefined}
                >
                    <div
                        className={cx(
                            'h-full',
                            responsiveClasses.rightPanelInner,
                        )}
                    >
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
