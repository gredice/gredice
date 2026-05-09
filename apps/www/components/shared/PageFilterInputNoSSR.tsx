'use client';

import dynamic from 'next/dynamic';
import type { PageFilterInputProps } from './PageFilterInput';

const PageFilterInput = dynamic(
    () => import('./PageFilterInput').then((module) => module.PageFilterInput),
    {
        ssr: false,
    },
);

export function PageFilterInputNoSSR(props: PageFilterInputProps) {
    return <PageFilterInput {...props} />;
}
