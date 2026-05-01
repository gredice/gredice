import { forwardRef } from 'react';
import type { CSSProperties, ImgHTMLAttributes } from 'react';

type StaticImageData = {
    src: string;
    height?: number;
    width?: number;
    blurDataURL?: string;
};

type StorybookNextImageProps = Omit<
    ImgHTMLAttributes<HTMLImageElement>,
    'height' | 'src' | 'width'
> & {
    src: string | StaticImageData;
    alt: string;
    height?: number | `${number}`;
    width?: number | `${number}`;
    fill?: boolean;
    priority?: boolean;
    quality?: number | `${number}`;
    placeholder?: 'blur' | 'empty' | `data:image/${string}`;
    blurDataURL?: string;
    unoptimized?: boolean;
    loader?: unknown;
    onLoadingComplete?: (image: HTMLImageElement) => void;
};

function resolveSrc(src: StorybookNextImageProps['src']) {
    return typeof src === 'string' ? src : src.src;
}

function resolveFillStyle(fill: boolean, style: CSSProperties | undefined) {
    if (!fill) {
        return style;
    }

    return {
        position: 'absolute',
        inset: 0,
        height: '100%',
        width: '100%',
        ...style,
    } satisfies CSSProperties;
}

function getImgProps({
    blurDataURL: _blurDataURL,
    fill = false,
    height,
    loader: _loader,
    onLoadingComplete: _onLoadingComplete,
    placeholder: _placeholder,
    priority = false,
    quality: _quality,
    src,
    style,
    unoptimized: _unoptimized,
    width,
    ...props
}: StorybookNextImageProps) {
    return {
        ...props,
        height: fill ? undefined : (height ?? resolveStaticHeight(src)),
        loading: props.loading ?? (priority ? 'eager' : undefined),
        src: resolveSrc(src),
        style: resolveFillStyle(fill, style),
        width: fill ? undefined : (width ?? resolveStaticWidth(src)),
    };
}

function resolveStaticHeight(src: StorybookNextImageProps['src']) {
    return typeof src === 'string' ? undefined : src.height;
}

function resolveStaticWidth(src: StorybookNextImageProps['src']) {
    return typeof src === 'string' ? undefined : src.width;
}

const StorybookNextImage = forwardRef<HTMLImageElement, StorybookNextImageProps>(
    function StorybookNextImage(props, ref) {
        const { onLoadingComplete } = props;
        const { alt, onLoad, ...imageProps } = getImgProps(props);

        return (
            // biome-ignore lint/performance/noImgElement: Storybook mock must not depend on Next's image runtime.
            <img
                {...imageProps}
                alt={alt}
                ref={ref}
                onLoad={(event) => {
                    onLoad?.(event);
                    onLoadingComplete?.(event.currentTarget);
                }}
            />
        );
    },
);

export function getImageProps(props: StorybookNextImageProps) {
    return {
        props: getImgProps(props),
    };
}

export default StorybookNextImage;
