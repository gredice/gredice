import ReactMarkdown from "react-markdown";
import { HTMLAttributes } from "react";
import { StyledHtml } from "./StyledHtml";

export function Markdown({ children, ...rest }: Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children: string }) {
    return (
        <StyledHtml {...rest}>
            <ReactMarkdown>{children}</ReactMarkdown>
        </StyledHtml>
    );
}