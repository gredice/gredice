import { serializeValidStructuredData } from './structuredDataValidation';

type StructuredDataScriptProps = {
    data: Record<string, unknown> | Record<string, unknown>[];
};

export function StructuredDataScript({ data }: StructuredDataScriptProps) {
    const { issues, serializedData } = serializeValidStructuredData(data);
    if (serializedData === null) {
        const issueSummary = issues
            .map((issue) => `${issue.path}: ${issue.message}`)
            .join('; ');
        const message = `Invalid structured data omitted: ${issueSummary}`;

        const isCi = process.env.CI === 'true' || process.env.CI === '1';
        if (process.env.NODE_ENV !== 'production' || isCi) {
            throw new Error(message);
        }

        console.error(message);
        return null;
    }

    return (
        <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD script injection is expected for structured data
            dangerouslySetInnerHTML={{
                __html: serializedData,
            }}
        />
    );
}
