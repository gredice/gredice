import {
    Head,
    Html,
    Markdown,
    Preview,
} from '@react-email/components';

export interface MarkdownEmailTemplateProps {
    content: string;
    previewText: string;
}

export default function MarkdownEmailTemplate({
    content,
    previewText
}: MarkdownEmailTemplateProps) {
    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Markdown>
                {content}
            </Markdown>
        </Html>
    );
}