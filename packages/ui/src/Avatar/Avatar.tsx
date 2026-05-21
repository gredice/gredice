import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../utils';

export type AvatarProps = HTMLAttributes<HTMLDivElement> & {
    size?: 'sm' | 'md' | 'lg';
} & (
        | {
              children: ReactNode;
              src?: never;
              alt?: never;
          }
        | {
              children?: never;
              src: string;
              alt: string;
          }
    );

const sizeClassNames = {
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-12 text-base',
};

export function Avatar({
    alt,
    children,
    className,
    size = 'md',
    src,
    ...rest
}: AvatarProps) {
    return (
        <div
            className={cx(
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-muted-foreground',
                sizeClassNames[size],
                className,
            )}
            {...rest}
        >
            {src ? (
                // biome-ignore lint/performance/noImgElement: avatar URLs can be user-provided and should not require Next image config
                <img src={src} alt={alt} className="size-full object-cover" />
            ) : (
                children
            )}
        </div>
    );
}
