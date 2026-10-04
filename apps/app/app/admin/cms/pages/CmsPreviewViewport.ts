'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type CmsPreviewViewport = 'auto' | 'mobile' | 'tablet' | 'desktop';

type CmsFixedPreviewViewport = Exclude<CmsPreviewViewport, 'auto'>;

export const cmsPagePreviewViewportClassNames = {
    auto: 'max-w-none',
    mobile: 'max-w-sm',
    tablet: 'max-w-2xl',
    desktop: 'max-w-none',
} satisfies Record<CmsPreviewViewport, string>;

export const cmsSectionInfoPreviewViewportClassNames = {
    auto: 'max-w-none',
    mobile: 'max-w-[22rem]',
    tablet: 'max-w-[44rem]',
    desktop: 'max-w-[72rem]',
} satisfies Record<CmsPreviewViewport, string>;

const cmsPreviewViewportMinWidths = {
    mobile: 0,
    tablet: 704,
    desktop: 1024,
} satisfies Record<CmsFixedPreviewViewport, number>;

const cmsPreviewViewportFallbackOrder: CmsFixedPreviewViewport[] = [
    'desktop',
    'tablet',
    'mobile',
];

export type CmsPreviewViewportSupport = Record<CmsPreviewViewport, boolean>;

function supportedCmsPreviewViewports(
    availableWidth: number | undefined,
): CmsPreviewViewportSupport {
    if (availableWidth === undefined) {
        return {
            auto: true,
            mobile: true,
            tablet: true,
            desktop: true,
        };
    }

    return {
        auto: true,
        mobile: true,
        tablet: availableWidth >= cmsPreviewViewportMinWidths.tablet,
        desktop: availableWidth >= cmsPreviewViewportMinWidths.desktop,
    };
}

function bestSupportedCmsPreviewViewport(
    supportedViewports: CmsPreviewViewportSupport,
): CmsPreviewViewport {
    for (const viewport of cmsPreviewViewportFallbackOrder) {
        if (supportedViewports[viewport]) {
            return viewport;
        }
    }

    return 'mobile';
}

export function useCmsPreviewViewportSupport(
    viewport: CmsPreviewViewport,
    onViewportChange: (viewport: CmsPreviewViewport) => void,
    options: { disabled?: boolean } = {},
) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [availableWidth, setAvailableWidth] = useState<number | undefined>();

    useEffect(() => {
        if (options.disabled) {
            return;
        }

        const element = containerRef.current;
        if (!element) {
            return;
        }

        const updateAvailableWidth = () => {
            setAvailableWidth(element.clientWidth);
        };

        updateAvailableWidth();

        if (!('ResizeObserver' in window)) {
            window.addEventListener('resize', updateAvailableWidth);
            return () =>
                window.removeEventListener('resize', updateAvailableWidth);
        }

        const resizeObserver = new ResizeObserver(updateAvailableWidth);
        resizeObserver.observe(element);
        return () => resizeObserver.disconnect();
    }, [options.disabled]);

    const supportedViewports = useMemo(
        () => supportedCmsPreviewViewports(availableWidth),
        [availableWidth],
    );

    useEffect(() => {
        if (options.disabled || supportedViewports[viewport]) {
            return;
        }

        onViewportChange(bestSupportedCmsPreviewViewport(supportedViewports));
    }, [onViewportChange, options.disabled, supportedViewports, viewport]);

    return {
        availableWidth,
        containerRef,
        supportedViewports,
    };
}
