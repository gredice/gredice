export type CmsPageCtaData = {
    id?: string;
    label?: string;
    href?: string;
    iconName?: string;
    secondary?: boolean;
};

export type CmsPageFeatureData = {
    id?: string;
    header?: string;
    description?: string;
    ctas?: CmsPageCtaData[];
};

export type CmsPageSectionData = {
    component: string;
    [key: string]: unknown;
};

export type CmsPageEditableSection = {
    id: string;
    data: CmsPageSectionData;
};
