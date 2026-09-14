import {
    Children,
    type HTMLAttributes,
    isValidElement,
    type ReactNode,
} from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StyledHtml } from '../StyledHtml';
import { MarkdownTable } from './MarkdownTable';

function getTextContent(node: ReactNode): string {
    if (typeof node === 'string' || typeof node === 'number') {
        return String(node);
    }

    if (Array.isArray(node)) {
        return node.map(getTextContent).join('');
    }

    if (isValidElement<{ children?: ReactNode }>(node)) {
        return getTextContent(node.props.children);
    }

    return '';
}

function getFallbackLinkLabel(href: string | undefined): string {
    if (!href) {
        return 'Poveznica';
    }

    try {
        const url = new URL(href, 'https://www.gredice.com');
        return `${url.hostname}${url.pathname}${url.search}`;
    } catch {
        return href;
    }
}

const components: Components = {
    table: ({ node: _node, ...props }) => <MarkdownTable {...props} />,
    a: ({ children, href, ...props }) => {
        const textContent = Children.toArray(children)
            .map(getTextContent)
            .join('')
            .trim();

        return (
            <a href={href} {...props}>
                {textContent || getFallbackLinkLabel(href)}
            </a>
        );
    },
};

export function Markdown({
    children,
    ...rest
}: Omit<
    HTMLAttributes<HTMLDivElement>,
    'children' | 'dangerouslySetInnerHTML'
> & {
    children: string;
}) {
    return (
        <StyledHtml {...rest}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {children}
            </ReactMarkdown>
        </StyledHtml>
    );
}
