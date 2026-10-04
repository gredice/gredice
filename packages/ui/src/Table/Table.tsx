import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cx } from '../utils';

function TableRoot({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
    return (
        <div className="relative w-full overflow-auto">
            <table
                className={cx('w-full caption-bottom text-sm', className)}
                {...rest}
            />
        </div>
    );
}

export function TableHeader({
    ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
    return <thead {...rest} />;
}

export function TableHead({
    className,
    ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
    return (
        <th
            className={cx(
                'h-12 px-4 text-left align-middle text-base font-medium text-muted-foreground',
                className,
            )}
            {...rest}
        />
    );
}

export function TableBody({
    className,
    ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
    return (
        <tbody
            className={cx('[&_tr:last-child]:border-0', className)}
            {...rest}
        />
    );
}

export function TableRow({
    className,
    ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
    return (
        <tr
            className={cx(
                'border-b transition-colors hover:bg-muted/50',
                className,
            )}
            {...rest}
        />
    );
}

export function TableCell({
    className,
    ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
    return (
        <td className={cx('p-4 align-middle text-base', className)} {...rest} />
    );
}

export const Table = Object.assign(TableRoot, {
    Header: TableHeader,
    Head: TableHead,
    Body: TableBody,
    Row: TableRow,
    Cell: TableCell,
});
