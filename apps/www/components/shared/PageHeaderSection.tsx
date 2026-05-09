import { PageHeader, type PageHeaderProps } from './PageHeader';

type PageHeaderSectionProps = Omit<PageHeaderProps, 'subHeader'> & {
    description?: string | null;
};

export function PageHeaderSection({
    description,
    ...props
}: PageHeaderSectionProps) {
    return <PageHeader {...props} subHeader={description} />;
}
