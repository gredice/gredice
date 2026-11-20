import type { SelectEntityTypeCategory } from '@gredice/storage';
import { IconButton } from '@gredice/ui/IconButton';
import { Edit } from '@gredice/ui/icons';
import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import { EntityTypeIcon } from '../../../../components/admin/directories/EntityTypeIcon';
import { KnownPages } from '../../../../src/KnownPages';

/** Directory categories with a link to edit each one. */
export function DirectoryCategoriesList({
    categories,
}: {
    categories: Pick<
        SelectEntityTypeCategory,
        'id' | 'name' | 'label' | 'icon'
    >[];
}) {
    if (categories.length === 0) {
        return (
            <NoDataPlaceholder className="py-4">
                Još nema kategorija zapisa.
            </NoDataPlaceholder>
        );
    }

    return (
        <ul className="grid grid-cols-1 gap-2 @lg/settings:grid-cols-2 @3xl/settings:grid-cols-3">
            {categories.map((category) => (
                <li
                    key={category.id}
                    className="flex min-w-0 items-center gap-3 rounded-md border py-1.5 pr-1.5 pl-3"
                >
                    <EntityTypeIcon
                        icon={
                            category.icon ??
                            (category.label === 'Ostali'
                                ? 'MoreHorizontal'
                                : undefined)
                        }
                        className="size-4 shrink-0 text-muted-foreground"
                    />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                            {category.label}
                        </p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                            {category.name}
                        </p>
                    </div>
                    <IconButton
                        href={KnownPages.DirectoryCategoryEdit(category.id)}
                        title={`Uredi kategoriju ${category.label}`}
                        size="sm"
                    >
                        <Edit className="size-4" />
                    </IconButton>
                </li>
            ))}
        </ul>
    );
}
