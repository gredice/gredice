import NextLink from 'next/link';
import {
    Children,
    type CSSProperties,
    type MouseEventHandler,
    type ReactElement,
    type ReactNode,
    type Ref,
} from 'react';
import { Skeleton } from '../Skeleton';
import { Stack, type StackProps } from '../Stack';
import { Typography } from '../Typography';
import { cx } from '../utils';

export type ListProps = StackProps & {
    variant?: 'outlined' | 'plain';
};

export function List({ className, variant = 'plain', ...rest }: ListProps) {
    return (
        <Stack
            className={cx(
                variant === 'outlined' && 'divide-y rounded-lg border',
                className,
            )}
            {...rest}
        />
    );
}

export type ListHeaderProps = StackProps & {
    header: ReactNode | string | undefined;
    icon?: ReactNode;
    actions?: (ReactNode | boolean | null)[];
    description?: string | ReactNode;
    isLoading?: boolean;
};

export function ListHeader({
    actions,
    className,
    description,
    header,
    icon,
    isLoading,
    spacing,
    ...rest
}: ListHeaderProps) {
    return (
        <Stack
            className={cx('w-full select-none', className)}
            spacing={spacing || 1}
            {...rest}
        >
            <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-1">
                <Stack className="shrink-0" spacing={1}>
                    {icon ? <div>{icon}</div> : null}
                    {isLoading ? <Skeleton className="h-5 w-32" /> : null}
                    {typeof header === 'string' ? (
                        <Typography
                            bold
                            level="body2"
                            noWrap
                            title={header}
                            uppercase
                        >
                            {header}
                        </Typography>
                    ) : (
                        header
                    )}
                </Stack>
                <Stack spacing={0.5}>
                    {Children.toArray(actions).filter(Boolean)}
                </Stack>
            </div>
            {description ? (
                typeof description === 'string' ? (
                    <Typography level="body2">{description}</Typography>
                ) : (
                    description
                )
            ) : null}
        </Stack>
    );
}

export type ListItemPropsCommon = {
    label: ReactElement | string | undefined;
    disabled?: boolean;
    startDecorator?: ReactElement;
    endDecorator?: ReactElement;
    className?: string;
    title?: string;
    style?: CSSProperties;
    variant?: 'outlined' | 'plain';
};

export type ListItemPropsOptions =
    | {
          href: string;
          nodeId?: never;
          selected?: boolean | undefined;
          onSelected?: never;
          onMouseEnter?: never;
          buttonRef?: Ref<HTMLAnchorElement>;
      }
    | {
          href?: never;
          nodeId: string;
          selected?: boolean;
          onSelected: (nodeId: string) => void;
          onMouseEnter?: MouseEventHandler<HTMLButtonElement>;
          buttonRef?: Ref<HTMLButtonElement>;
      }
    | {
          href?: never;
          nodeId?: never;
          selected?: never;
          onSelected?: never;
          onMouseEnter?: never;
          buttonRef?: never;
      };

export type ListItemProps = ListItemPropsCommon & ListItemPropsOptions;

function listItemClassName({
    className,
    selected,
    variant,
}: {
    className?: string;
    selected?: boolean;
    variant?: 'outlined' | 'plain';
}) {
    return cx(
        'flex h-auto w-full items-center justify-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
        selected
            ? 'bg-muted text-foreground'
            : 'bg-transparent text-foreground hover:bg-muted',
        variant === 'outlined' &&
            'rounded-none first:rounded-t-[calc(var(--radius)-1px)] last:rounded-b-[calc(var(--radius)-1px)]',
        className,
    );
}

export function ListItem({
    buttonRef,
    className,
    disabled,
    endDecorator,
    href,
    label,
    nodeId,
    onMouseEnter,
    onSelected,
    selected,
    startDecorator,
    variant = 'plain',
    ...rest
}: ListItemProps) {
    const content = (
        <>
            {startDecorator}
            {label ? <div className="min-w-0 grow">{label}</div> : null}
            {endDecorator}
        </>
    );
    const mergedClassName = listItemClassName({ className, selected, variant });

    if (href) {
        return (
            <NextLink
                className={mergedClassName}
                href={href}
                ref={buttonRef}
                {...rest}
            >
                {content}
            </NextLink>
        );
    }

    if (nodeId && onSelected) {
        return (
            <button
                className={mergedClassName}
                disabled={disabled}
                onClick={() => onSelected(nodeId)}
                onMouseEnter={onMouseEnter}
                ref={buttonRef}
                type="button"
                {...rest}
            >
                {content}
            </button>
        );
    }

    return (
        <div
            className={cx(mergedClassName, disabled && 'opacity-50')}
            {...rest}
        >
            {content}
        </div>
    );
}
