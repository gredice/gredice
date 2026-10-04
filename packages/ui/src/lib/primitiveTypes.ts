import type { RefObject } from 'react';

export type UiAlign = 'start' | 'center' | 'end';
export type UiCheckedState = boolean | 'indeterminate';
export type UiDirection = 'ltr' | 'rtl';
export type UiOrientation = 'horizontal' | 'vertical';
export type UiSide = 'top' | 'right' | 'bottom' | 'left';

export type UiCollisionPadding = number | Partial<Record<UiSide, number>>;

export type UiVirtualElement = {
    getBoundingClientRect(): DOMRect;
};

export type UiVirtualElementRef = RefObject<UiVirtualElement>;

export type LegacyAsChildProps = {
    /**
     * Temporary compatibility for existing consumers. New composition should
     * use the shared component's documented render contract after its Base UI
     * migration lands.
     */
    asChild?: boolean;
};
