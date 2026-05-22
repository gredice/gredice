import { cva, type VariantProps } from 'class-variance-authority';
import NextLink from 'next/link';
import type {
    AnchorHTMLAttributes,
    ButtonHTMLAttributes,
    ComponentProps,
    MouseEvent,
    ReactNode,
} from 'react';
import { Spinner } from '../Spinner';
import { cx } from '../utils';

export type VariantKeys = 'plain' | 'soft' | 'solid' | 'outlined';
export type ButtonColor =
    | 'primary'
    | 'secondary'
    | 'danger'
    | 'error'
    | 'warning'
    | 'info'
    | 'success'
    | 'neutral';

const buttonClassNames = cva(
    'relative inline-flex min-w-0 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    {
        variants: {
            variant: {
                plain: 'bg-transparent hover:bg-muted text-foreground',
                soft: 'bg-muted text-foreground hover:bg-muted/80',
                solid: 'bg-primary text-primary-foreground hover:bg-primary/90',
                outlined:
                    'border border-input bg-background hover:bg-muted text-foreground',
                link: 'h-auto p-0 text-primary underline-offset-4 hover:underline',
            },
            size: {
                xs: 'h-7 px-2 text-xs',
                sm: 'h-8 px-3 text-xs',
                md: 'h-10 px-4',
                lg: 'h-11 px-5 text-base',
            },
            fullWidth: {
                true: 'w-full',
                false: '',
            },
        },
        defaultVariants: {
            variant: 'solid',
            size: 'md',
            fullWidth: false,
        },
    },
);

type ButtonOwnProps = VariantProps<typeof buttonClassNames> & {
    variant?: VariantKeys | 'link';
    color?: ButtonColor;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    startDecorator?: ReactNode;
    endDecorator?: ReactNode;
    loading?: boolean;
    fullWidth?: boolean;
    disabled?: boolean;
};

export type ButtonButtonProps = ButtonOwnProps &
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps> & {
        href?: never;
    };

export type ButtonLinkProps = ButtonOwnProps &
    Omit<
        AnchorHTMLAttributes<HTMLAnchorElement>,
        keyof ButtonOwnProps | 'href'
    > & {
        href: string;
    };

export type ButtonProps = ButtonButtonProps | ButtonLinkProps;

function isLinkButton(props: ButtonProps): props is ButtonLinkProps {
    return typeof props.href === 'string';
}

const buttonColorClassNames = {
    solid: {
        primary: '',
        secondary:
            'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600',
        error: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600',
        warning:
            'bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500',
        info: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600',
        success:
            'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600',
        neutral: 'bg-muted text-foreground hover:bg-muted/80',
    },
    outlined: {
        primary: 'border-primary text-primary hover:bg-primary/10',
        secondary:
            'border-secondary text-secondary-foreground hover:bg-secondary/40',
        danger: 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950',
        error: 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950',
        warning:
            'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950',
        info: 'border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950',
        success:
            'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950',
        neutral: '',
    },
    soft: {
        primary: 'bg-primary/10 text-primary hover:bg-primary/15',
        secondary: '',
        danger: 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900',
        error: 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900',
        warning:
            'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900',
        info: 'bg-blue-100 text-blue-900 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900',
        success:
            'bg-green-100 text-green-900 hover:bg-green-200 dark:bg-green-950 dark:text-green-200 dark:hover:bg-green-900',
        neutral: '',
    },
    plain: {
        primary: 'text-primary hover:bg-primary/10',
        secondary: '',
        danger: 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950',
        error: 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950',
        warning:
            'text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950',
        info: 'text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950',
        success:
            'text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-950',
        neutral: '',
    },
    link: {
        primary: '',
        secondary: 'text-secondary-foreground',
        danger: 'text-red-700 dark:text-red-300',
        error: 'text-red-700 dark:text-red-300',
        warning: 'text-amber-700 dark:text-amber-300',
        info: 'text-blue-700 dark:text-blue-300',
        success: 'text-green-700 dark:text-green-300',
        neutral: 'text-muted-foreground',
    },
} satisfies Record<VariantKeys | 'link', Record<ButtonColor, string>>;

function buttonColorClassName(
    variant: ButtonOwnProps['variant'],
    color: ButtonOwnProps['color'],
) {
    return buttonColorClassNames[variant ?? 'solid'][color ?? 'primary'];
}

function buttonContent({
    children,
    endDecorator,
    loading,
    startDecorator,
}: Pick<
    ButtonOwnProps & { children?: ReactNode },
    'children' | 'endDecorator' | 'loading' | 'startDecorator'
>) {
    return (
        <>
            {loading ? (
                <Spinner loadingLabel="Ucitavanje" className="shrink-0" />
            ) : (
                startDecorator
            )}
            {children}
            {endDecorator}
        </>
    );
}

export function Button(props: ButtonProps) {
    if (isLinkButton(props)) {
        const {
            children,
            className,
            color,
            disabled,
            endDecorator,
            fullWidth,
            href,
            loading,
            onClick,
            size,
            startDecorator,
            variant,
            ...rest
        } = props;

        const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
            if (disabled || loading) {
                event.preventDefault();
                return;
            }

            onClick?.(event);
        };
        const handleLinkClick =
            disabled || loading || onClick ? handleClick : undefined;

        return (
            <NextLink
                aria-disabled={disabled || loading}
                className={cx(
                    buttonClassNames({ fullWidth, size, variant }),
                    buttonColorClassName(variant, color),
                    className,
                )}
                href={href as ComponentProps<typeof NextLink>['href']}
                onClick={handleLinkClick}
                tabIndex={disabled || loading ? -1 : rest.tabIndex}
                {...rest}
            >
                {buttonContent({
                    children,
                    endDecorator,
                    loading,
                    startDecorator,
                })}
            </NextLink>
        );
    }

    const {
        children,
        className,
        color,
        disabled,
        endDecorator,
        fullWidth,
        loading,
        size,
        startDecorator,
        variant,
        ...rest
    } = props;

    return (
        <button
            className={cx(
                buttonClassNames({ fullWidth, size, variant }),
                buttonColorClassName(variant, color),
                className,
            )}
            disabled={disabled || loading}
            {...rest}
        >
            {buttonContent({ children, endDecorator, loading, startDecorator })}
        </button>
    );
}
