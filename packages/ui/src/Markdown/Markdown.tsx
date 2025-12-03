import type { HTMLAttributes } from 'react';
import ReactMarkdown from 'react-markdown';
import { StyledHtml } from '../StyledHtml';

export function Markdown({
    children,
    ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children: string }) {
    return (
        <StyledHtml {...rest}>
            <ReactMarkdown>{children}</ReactMarkdown>
        </StyledHtml>
    );
}
