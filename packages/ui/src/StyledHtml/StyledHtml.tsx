import type { HTMLAttributes } from 'react';
import { cx } from '../utils';
import './StyledHtml.css';

export type StyledHtmlProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    'dangerouslySetInnerHTML'
> & {
    html?: string;
};

const styledHtmlClassName = (className: string | undefined) =>
    cx(
        'max-w-none',
        'prose prose-p:my-2 prose-sm prose-headings:font-normal prose-hr:my-6',
        'text-primary prose-headings:text-primary',
        'prose-a:text-primary',
        'prose-hr:border-border',
        className,
    );

export function StyledHtml({
    children,
    className,
    html,
    ...rest
}: StyledHtmlProps) {
    if (typeof html === 'string') {
        return (
            <div
                className={styledHtmlClassName(className)}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: StyledHtml renders trusted source-controlled or CMS-author HTML through one shared API.
                dangerouslySetInnerHTML={{ __html: html }}
                {...rest}
            />
        );
    }

    return (
        <div className={styledHtmlClassName(className)} {...rest}>
            {children}
        </div>
    );
}
