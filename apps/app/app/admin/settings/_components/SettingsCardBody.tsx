import { cx } from '@gredice/ui/utils';
import type { HTMLAttributes } from 'react';

/** Padded content area of a `SettingsCard`. */
export function SettingsCardBody({
    className,
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    return <div className={cx('space-y-4 p-4', className)} {...props} />;
}
