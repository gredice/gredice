import { Breadcrumbs, type BreadcrumbsProps } from '@gredice/ui/Breadcrumbs';
import {
    createPublicBreadcrumbStructuredData,
    type PublicBreadcrumbItems,
} from './breadcrumbStructuredData';
import { StructuredDataScript } from './StructuredDataScript';

type PublicBreadcrumbsProps = Omit<BreadcrumbsProps, 'items'> & {
    items: PublicBreadcrumbItems;
};

export function PublicBreadcrumbs({
    items,
    ...breadcrumbsProps
}: PublicBreadcrumbsProps) {
    return (
        <>
            <StructuredDataScript
                data={createPublicBreadcrumbStructuredData(items)}
            />
            <Breadcrumbs items={[...items]} {...breadcrumbsProps} />
        </>
    );
}
