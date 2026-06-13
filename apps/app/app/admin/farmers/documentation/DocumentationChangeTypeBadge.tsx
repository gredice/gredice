import {
    documentationChangeLabel,
    type FarmerDocumentationChangeType,
} from './farmerDocumentationData';

export function DocumentationChangeTypeBadge({
    type,
}: {
    type: FarmerDocumentationChangeType;
}) {
    const className = {
        discard: 'bg-red-100 text-red-800',
        insert: 'bg-green-100 text-green-800',
        replace: 'bg-blue-100 text-blue-800',
    }[type];

    return (
        <span
            className={`rounded-md px-2 py-1 text-xs font-medium ${className}`}
        >
            {documentationChangeLabel(type)}
        </span>
    );
}
