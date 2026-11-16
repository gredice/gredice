import type { HTMLAttributes } from 'react';
import sanitizeHtml from 'sanitize-html';
import { cx } from '../utils';
import './StyledHtml.css';

/**
 * Text size of the prose content.
 * - `sm` (default): compact text for cards, panels, dialogs and admin tools.
 * - `md`: reading size for long-form main content on public pages.
 */
export type StyledHtmlSize = 'sm' | 'md';

export type StyledHtmlProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    'dangerouslySetInnerHTML'
> & {
    html?: string;
    size?: StyledHtmlSize;
};

const sizeClassNames = {
    sm: 'prose-sm',
    md: 'prose-base',
} satisfies Record<StyledHtmlSize, string>;

const styledHtmlClassName = (
    size: StyledHtmlSize,
    className: string | undefined,
) =>
    cx(
        'max-w-none',
        'prose prose-p:my-2 prose-headings:font-normal prose-hr:my-6',
        sizeClassNames[size],
        'text-primary prose-headings:text-primary',
        'prose-a:text-primary',
        'prose-hr:border-border',
        className,
    );

export function StyledHtml({
    children,
    className,
    html,
    size = 'sm',
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
                img: [
                    'src',
                    'srcset',
                    'alt',
                    'title',
                    'width',
                    'height',
                    'loading',
                ],
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
                className={styledHtmlClassName(size, className)}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is sanitized before rendering.
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                {...rest}
            />
        );
    }

    return (
        <div className={styledHtmlClassName(size, className)} {...rest}>
            {children}
        </div>
    );
}
