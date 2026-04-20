type StructuredDataScriptProps = {
    data: Record<string, unknown> | Record<string, unknown>[];
};

export function StructuredDataScript({ data }: StructuredDataScriptProps) {
    return (
        <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD script injection is expected for structured data
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(data).replace(/</g, '\\u003c'),
            }}
        />
    );
}
