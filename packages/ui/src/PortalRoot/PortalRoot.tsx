import type { HTMLAttributes } from 'react';
import { cx } from '../utils';

export const UI_APPLICATION_ROOT_ATTRIBUTE = 'data-gredice-ui-root';
export const UI_PORTAL_ROOT_ATTRIBUTE = 'data-gredice-ui-portal-root';

export type UiApplicationRootProps = HTMLAttributes<HTMLDivElement>;

/**
 * Isolates application stacking contexts from overlays portaled to the body.
 */
export function UiApplicationRoot({
    className,
    ...props
}: UiApplicationRootProps) {
    return (
        <div
            className={cx('gredice-ui-application-root', className)}
            data-gredice-ui-root=""
            {...props}
        />
    );
}

export function getUiPortalRoot(ownerDocument?: Document) {
    const resolvedDocument =
        ownerDocument ??
        (typeof document === 'undefined' ? undefined : document);

    return (
        resolvedDocument?.querySelector<HTMLElement>(
            `[${UI_PORTAL_ROOT_ATTRIBUTE}]`,
        ) ?? null
    );
}
