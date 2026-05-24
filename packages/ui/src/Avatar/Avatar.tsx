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
    sm: 'h-6 min-w-[24px] max-w-[24px] text-xs',
    md: 'h-9 min-w-[36px] max-w-[36px]',
    lg: 'h-12 min-w-[48px] max-w-[48px] text-lg',
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
