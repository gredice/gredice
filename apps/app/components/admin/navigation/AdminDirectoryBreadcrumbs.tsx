import { type BreadcrumbItem, Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { AdminBreadcrumbLevelSelector } from './AdminBreadcrumbLevelSelector';
import { AdminDirectoryCategoryBreadcrumbSelector } from './AdminDirectoryCategoryBreadcrumbSelector';
import { AdminDirectoryEntityTypeBreadcrumbSelector } from './AdminDirectoryEntityTypeBreadcrumbSelector';

export function AdminDirectoryBreadcrumbs({
    entityTypeName,
    entityTypeLabel,
    items = [],
}: {
    entityTypeName?: string;
    entityTypeLabel?: string;
    items?: BreadcrumbItem[];
}) {
    const breadcrumbs: BreadcrumbItem[] = [
        {
            label: <AdminBreadcrumbLevelSelector />,
        },
    ];

    if (entityTypeName) {
        breadcrumbs.push(
            {
                label: (
                    <AdminDirectoryCategoryBreadcrumbSelector
                        entityTypeName={entityTypeName}
                    />
                ),
            },
            {
                label: (
                    <AdminDirectoryEntityTypeBreadcrumbSelector
                        entityTypeName={entityTypeName}
                        fallbackLabel={entityTypeLabel}
                    />
                ),
            },
        );
    }

    return <Breadcrumbs items={[...breadcrumbs, ...items]} />;
}
