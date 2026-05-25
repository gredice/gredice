import type { HTMLAttributes } from 'react';
import sanitizeHtml from 'sanitize-html';
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
        const sanitizedHtml = sanitizeHtml(html, {
            allowedTags: sanitizeHtml.defaults.allowedTags.concat([
                'h1',
                'h2',
                'h3',
                'h4',
                'h5',
                'h6',
                'img',
                'iframe',
                'table',
                'thead',
                'tbody',
                'tfoot',
                'tr',
                'th',
                'td',
            ]),
            allowedAttributes: {
                ...sanitizeHtml.defaults.allowedAttributes,
                '*': ['class'],
                a: ['href', 'name', 'target', 'rel'],
                img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
                iframe: [
                    'src',
                    'title',
                    'width',
                    'height',
                    'allow',
                    'allowfullscreen',
                    'loading',
                    'referrerpolicy',
                ],
                th: ['colspan', 'rowspan', 'scope'],
                td: ['colspan', 'rowspan'],
            },
            allowedSchemes: ['http', 'https', 'mailto', 'tel'],
            allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
            allowProtocolRelative: false,
        });

        return (
            <div
                className={styledHtmlClassName(className)}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is sanitized before rendering.
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
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
