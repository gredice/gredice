export type CmsPageSectionComponent = {
    component: string;
    label: string;
    fields: Array<{
        key: string;
        label: string;
        type: 'text' | 'textarea';
        rows?: number;
        required?: boolean;
    }>;
    isCustom?: boolean;
};

export const cmsPageSectionComponents = [
    {
        component: 'Heading1',
        label: 'Heading1',
        fields: [
            { key: 'header', label: 'Naslov', type: 'text', required: true },
            {
                key: 'description',
                label: 'Opis',
                type: 'textarea',
                rows: 4,
                required: true,
            },
        ],
    },
    {
        component: 'Feature1',
        label: 'Feature1',
        fields: [
            { key: 'header', label: 'Naslov', type: 'text', required: true },
            {
                key: 'description',
                label: 'Opis',
                type: 'textarea',
                rows: 4,
                required: true,
            },
        ],
    },
    {
        component: 'Faq1',
        label: 'Faq1',
        fields: [
            { key: 'header', label: 'Naslov', type: 'text', required: true },
            {
                key: 'description',
                label: 'Opis',
                type: 'textarea',
                rows: 4,
                required: true,
            },
        ],
    },
    {
        component: 'Footer1',
        label: 'Footer1',
        fields: [
            { key: 'header', label: 'Naslov', type: 'text' },
            { key: 'description', label: 'Opis', type: 'textarea', rows: 4 },
        ],
    },
    {
        component: 'PageHeader',
        label: 'Page header',
        isCustom: true,
        fields: [
            { key: 'header', label: 'Naslov', type: 'text' },
            { key: 'description', label: 'Opis', type: 'textarea', rows: 4 },
        ],
    },
] satisfies CmsPageSectionComponent[];

export const supportedCmsPageSectionComponents = new Set(
    cmsPageSectionComponents.map((section) => section.component),
);

export function getCmsPageSectionComponent(component: string) {
    return cmsPageSectionComponents.find(
        (item) => item.component === component,
    );
}
