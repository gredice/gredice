import {
    Binary,
    Code,
    File,
    FontType,
    Hash,
    Tally3,
    ToggleRight,
} from '@signalco/ui-icons';
import type { HTMLAttributes, ReactNode } from 'react';

export type AttributeDataTypeItem = {
    value: string;
    label: string;
    icon?: ReactNode;
};

export const attributeDataTypeItems: AttributeDataTypeItem[] = [
    {
        value: 'text',
        label: 'Tekst',
        icon: <FontType className="size-5" />,
    },
    {
        value: 'number',
        label: 'Broj',
        icon: <Hash className="size-5" />,
    },
    {
        value: 'range',
        label: 'Raspon',
        icon: <RangeIcon className="size-5" />,
    },
    {
        value: 'boolean',
        label: 'Da / Ne',
        icon: <ToggleRight className="size-5" />,
    },
    {
        value: 'barcode',
        label: 'Barkod',
        icon: <Tally3 className="size-5" />,
    },
    {
        value: 'markdown',
        label: 'Markdown',
        icon: <AttributeMarkdownIcon className="size-5" />,
    },
    {
        value: 'image',
        label: 'Slika',
        icon: <AttributeImageIcon className="size-5" />,
    },
    {
        value: 'json',
        label: 'JSON',
        icon: <Code className="size-5" />,
    },
];

export function AttributeDataTypeIcon({
    dataType,
    ...rest
}: { dataType: string } & HTMLAttributes<SVGElement>) {
    if (dataType.startsWith('ref:')) {
        return <File {...rest} />;
    }

    if (dataType === 'json' || dataType.startsWith('json|')) {
        return <Code {...rest} />;
    }
    if (dataType === 'range' || dataType.startsWith('range|')) {
        return <RangeIcon {...rest} />;
    }

    switch (dataType) {
        case 'text':
            return <FontType {...rest} />;
        case 'number':
            return <Hash {...rest} />;
        case 'range':
            return <RangeIcon {...rest} />;
        case 'boolean':
            return <ToggleRight {...rest} />;
        case 'barcode':
            return <Tally3 {...rest} />;
        case 'markdown':
            return <AttributeMarkdownIcon {...rest} />;
        case 'image':
            return <AttributeImageIcon {...rest} />;
        default:
            return <Binary {...rest} />;
    }
}

export function getAttributeDataTypeLabel(dataType: string) {
    const found = attributeDataTypeItems.find(
        (item) => item.value === dataType,
    );
    if (found) {
        return found.label;
    }

    if (dataType.startsWith('ref:')) {
        return `Referenca: ${dataType.substring(4)}`;
    }

    if (dataType.startsWith('json|')) {
        return 'JSON';
    }
    if (dataType.startsWith('range|')) {
        const parsedRangeDataType = parseRangeDataType(dataType);
        return `Raspon (${parsedRangeDataType.min} - ${parsedRangeDataType.max})`;
    }

    return dataType;
}

export function parseRangeDataType(dataType: string): {
    min: string;
    max: string;
} {
    const [, min, max] = dataType.split('|');
    return {
        min: min ?? '0',
        max: max ?? '100',
    };
}

export function buildRangeDataType(min: string, max: string): string {
    return `range|${min}|${max}`;
}

function AttributeMarkdownIcon(props: HTMLAttributes<SVGElement>): ReactNode {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <title>Markdown</title>
            <path d="M2 16V8l4 4 4-4v8" />
            <path d="M18 8v8" />
            <path d="m22 12-4 4-4-4" />
        </svg>
    );
}

function AttributeImageIcon(props: HTMLAttributes<SVGElement>): ReactNode {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <title>Image</title>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
        </svg>
    );
}

function RangeIcon(props: HTMLAttributes<SVGElement>): ReactNode {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <title>Range</title>
            <path d="M4 6h16" />
            <path d="M8 12h8" />
            <path d="M11 18h2" />
        </svg>
    );
}
