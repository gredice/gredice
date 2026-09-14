export type StructuredDataIssue = {
    path: string;
    message: string;
};

export type StructuredDataSerialization = {
    issues: StructuredDataIssue[];
    serializedData: string | null;
};

const schemaContexts = new Set(['https://schema.org', 'https://schema.org/']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveNumber(value: unknown): boolean {
    if (typeof value === 'number') {
        return Number.isFinite(value) && value > 0;
    }

    return (
        typeof value === 'string' &&
        value.trim().length > 0 &&
        Number.isFinite(Number(value)) &&
        Number(value) > 0
    );
}

function isNonNegativeNumber(value: unknown): boolean {
    if (typeof value === 'number') {
        return Number.isFinite(value) && value >= 0;
    }

    return (
        typeof value === 'string' &&
        value.trim().length > 0 &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0
    );
}

function schemaTypes(node: Record<string, unknown>): string[] {
    const type = node['@type'];
    if (typeof type === 'string') {
        return [type];
    }

    return Array.isArray(type)
        ? type.filter((entry): entry is string => typeof entry === 'string')
        : [];
}

function validateProduct(
    node: Record<string, unknown>,
    path: string,
    issues: StructuredDataIssue[],
) {
    if (!isNonEmptyString(node.name)) {
        issues.push({
            path,
            message: 'Product must have a non-empty name.',
        });
    }

    if (!hasValidProductQualifier(node)) {
        issues.push({
            path,
            message:
                'Product must specify offers, review, or aggregateRating for Google Product snippets.',
        });
    }
}

function nodesFrom(value: unknown): Record<string, unknown>[] {
    const candidates = Array.isArray(value) ? value : [value];
    return candidates.filter(isRecord);
}

function hasValidTypedNode(value: unknown, acceptedTypes: string[]): boolean {
    return nodesFrom(value).some((candidate) => {
        const types = schemaTypes(candidate);
        const matchingType = acceptedTypes.find((type) => types.includes(type));
        if (!matchingType) {
            return false;
        }

        const candidateIssues: StructuredDataIssue[] = [];
        if (matchingType === 'Offer') {
            validateOffer(candidate, '$', candidateIssues);
        } else if (matchingType === 'AggregateOffer') {
            validateAggregateOffer(candidate, '$', candidateIssues);
        } else if (matchingType === 'Review') {
            validateReview(candidate, '$', candidateIssues);
        } else if (matchingType === 'AggregateRating') {
            validateAggregateRating(candidate, '$', candidateIssues);
        }

        return candidateIssues.length === 0;
    });
}

function hasValidProductQualifier(node: Record<string, unknown>): boolean {
    return (
        hasValidTypedNode(node.offers, ['Offer', 'AggregateOffer']) ||
        hasValidTypedNode(node.review, ['Review']) ||
        hasValidTypedNode(node.aggregateRating, ['AggregateRating'])
    );
}

function validateOffer(
    node: Record<string, unknown>,
    path: string,
    issues: StructuredDataIssue[],
) {
    if (!isNonNegativeNumber(node.price)) {
        issues.push({
            path,
            message: 'Offer must have a non-negative numeric price.',
        });
    }

    if (
        !isNonEmptyString(node.priceCurrency) ||
        !/^[A-Z]{3}$/.test(node.priceCurrency)
    ) {
        issues.push({
            path,
            message:
                'Offer must have a three-letter uppercase ISO priceCurrency.',
        });
    }
}

function validateAggregateOffer(
    node: Record<string, unknown>,
    path: string,
    issues: StructuredDataIssue[],
) {
    if (!isNonNegativeNumber(node.lowPrice)) {
        issues.push({
            path,
            message: 'AggregateOffer must have a non-negative lowPrice.',
        });
    }

    if (
        !isNonEmptyString(node.priceCurrency) ||
        !/^[A-Z]{3}$/.test(node.priceCurrency)
    ) {
        issues.push({
            path,
            message:
                'AggregateOffer must have a three-letter uppercase ISO priceCurrency.',
        });
    }
}

function validateReview(
    node: Record<string, unknown>,
    path: string,
    issues: StructuredDataIssue[],
) {
    if (
        !isRecord(node.reviewRating) ||
        !schemaTypes(node.reviewRating).includes('Rating') ||
        !isNonNegativeNumber(node.reviewRating.ratingValue)
    ) {
        issues.push({
            path,
            message: 'Review must have a Rating with a numeric ratingValue.',
        });
    }

    if (!isRecord(node.author) || !isNonEmptyString(node.author.name)) {
        issues.push({
            path,
            message: 'Review must have an author with a non-empty name.',
        });
    }
}

function validateAggregateRating(
    node: Record<string, unknown>,
    path: string,
    issues: StructuredDataIssue[],
) {
    if (!isNonNegativeNumber(node.ratingValue)) {
        issues.push({
            path,
            message: 'AggregateRating must have a numeric ratingValue.',
        });
    }

    if (
        !isPositiveNumber(node.reviewCount) &&
        !isPositiveNumber(node.ratingCount)
    ) {
        issues.push({
            path,
            message:
                'AggregateRating must have a positive reviewCount or ratingCount.',
        });
    }
}

function isAbsoluteHttpUrl(value: unknown): value is string {
    if (!isNonEmptyString(value)) {
        return false;
    }

    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function validateBreadcrumbList(
    node: Record<string, unknown>,
    path: string,
    issues: StructuredDataIssue[],
) {
    const itemListElement = node.itemListElement;
    if (!Array.isArray(itemListElement) || itemListElement.length < 2) {
        issues.push({
            path,
            message: 'BreadcrumbList must contain at least two ListItems.',
        });
        return;
    }

    itemListElement.forEach((item, index) => {
        const itemPath = `${path}.itemListElement[${index}]`;
        if (!isRecord(item)) {
            issues.push({
                path: itemPath,
                message: 'BreadcrumbList entries must be ListItem objects.',
            });
            return;
        }

        if (!schemaTypes(item).includes('ListItem')) {
            issues.push({
                path: itemPath,
                message: 'BreadcrumbList entries must use @type ListItem.',
            });
        }

        if (
            typeof item.position !== 'number' ||
            !Number.isInteger(item.position) ||
            item.position !== index + 1
        ) {
            issues.push({
                path: itemPath,
                message:
                    'Breadcrumb ListItem positions must be sequential positive integers.',
            });
        }

        if (!isNonEmptyString(item.name)) {
            issues.push({
                path: itemPath,
                message: 'Breadcrumb ListItem must have a non-empty name.',
            });
        }

        const isLastItem = index === itemListElement.length - 1;
        if (
            (!isLastItem || item.item !== undefined) &&
            !isAbsoluteHttpUrl(item.item)
        ) {
            issues.push({
                path: itemPath,
                message:
                    'Breadcrumb ListItem must have an absolute HTTP(S) item URL unless it is last.',
            });
        }
    });
}

function visitNode(
    value: unknown,
    path: string,
    issues: StructuredDataIssue[],
) {
    if (Array.isArray(value)) {
        value.forEach((entry, index) => {
            visitNode(entry, `${path}[${index}]`, issues);
        });
        return;
    }

    if (!isRecord(value)) {
        return;
    }

    const type = value['@type'];
    if (
        type !== undefined &&
        !isNonEmptyString(type) &&
        !(
            Array.isArray(type) &&
            type.length > 0 &&
            type.every(isNonEmptyString)
        )
    ) {
        issues.push({
            path,
            message: '@type must be a non-empty string or string array.',
        });
    }

    const types = schemaTypes(value);
    if (types.includes('Product')) {
        validateProduct(value, path, issues);
    }
    if (types.includes('Offer')) {
        validateOffer(value, path, issues);
    }
    if (types.includes('AggregateOffer')) {
        validateAggregateOffer(value, path, issues);
    }
    if (types.includes('Review')) {
        validateReview(value, path, issues);
    }
    if (types.includes('AggregateRating')) {
        validateAggregateRating(value, path, issues);
    }
    if (types.includes('BreadcrumbList')) {
        validateBreadcrumbList(value, path, issues);
    }

    for (const [key, entry] of Object.entries(value)) {
        visitNode(entry, `${path}.${key}`, issues);
    }
}

export function validateStructuredData(data: unknown): StructuredDataIssue[] {
    const issues: StructuredDataIssue[] = [];
    const roots = Array.isArray(data) ? data : [data];

    roots.forEach((root, index) => {
        const path = roots.length === 1 ? '$' : `$[${index}]`;
        if (!isRecord(root)) {
            issues.push({
                path,
                message: 'Structured data root must be an object.',
            });
            return;
        }

        if (!schemaContexts.has(String(root['@context']))) {
            issues.push({
                path,
                message:
                    'Structured data root must use the https://schema.org context.',
            });
        }

        visitNode(root, path, issues);
    });

    return issues;
}

export function validateSerializedStructuredData(
    serializedData: string,
): StructuredDataIssue[] {
    try {
        return validateStructuredData(JSON.parse(serializedData));
    } catch {
        return [
            {
                path: '$',
                message: 'Structured data script must contain valid JSON.',
            },
        ];
    }
}

export function serializeValidStructuredData(
    data: unknown,
): StructuredDataSerialization {
    const issues = validateStructuredData(data);
    if (issues.length > 0) {
        return { issues, serializedData: null };
    }

    return {
        issues,
        serializedData: JSON.stringify(data).replace(/</g, '\\u003c'),
    };
}
