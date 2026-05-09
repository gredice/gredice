import Image from 'next/image';
import type { ComponentProps } from 'react';

const logotypeAspectRatio = 163 / 44;

type LogotypeProps = Omit<
    ComponentProps<typeof Image>,
    'alt' | 'height' | 'src' | 'width'
> & {
    alt?: string;
    height?: number;
    width?: number;
};

export function Logotype({
    alt = 'Gredice',
    height = 44,
    width,
    ...props
}: LogotypeProps) {
    return (
        <Image
            alt={alt}
            height={height}
            src="https://cdn.gredice.com/Logotype-gredice_2x.png"
            unoptimized
            width={width ?? Math.round(height * logotypeAspectRatio)}
            {...props}
        />
    );
}
