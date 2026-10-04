import type { ComponentType, ReactElement } from 'react';
import { Row } from '../Row';
import { Stack } from '../Stack';
import { Typography } from '../Typography';

export type GalleryItem = {
    id: string;
};

export type GalleryItemComponent<TItem extends GalleryItem> =
    ComponentType<TItem>;

export type GalleryGridFilterProps = {
    header?: string;
    filters?: ReactElement;
};

export function GalleryGridFilter({ header, filters }: GalleryGridFilterProps) {
    return (
        <Row justifyContent="space-between" spacing={2}>
            {header && (
                <Typography gutterBottom level="h5">
                    {header}
                </Typography>
            )}
            {filters}
        </Row>
    );
}

export type GalleryGridProps<TItem extends GalleryItem> = {
    items: TItem[];
    itemComponent: GalleryItemComponent<TItem>;
};

export function GalleryGrid<TItem extends GalleryItem>({
    items,
    itemComponent,
}: GalleryGridProps<TItem>) {
    const ItemComponent = itemComponent;

    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {items.map((item) => (
                <ItemComponent key={item.id} {...item} />
            ))}
        </div>
    );
}

export type GalleryFiltersProps = {
    filters: ReactElement;
};

export function GalleryFilters({ filters }: GalleryFiltersProps) {
    return (
        <Stack className="h-fit w-full gap-1 md:max-w-[24%] md:gap-4">
            {filters}
        </Stack>
    );
}

export type GalleryProps<TItem extends GalleryItem> = {
    items: TItem[];
    itemComponent: GalleryItemComponent<TItem>;
    filters?: () => ReactElement;
    gridHeader?: string;
    gridFilters?: ReactElement;
};

export function Gallery<TItem extends GalleryItem>({
    items,
    itemComponent,
    filters,
    gridHeader,
    gridFilters,
}: GalleryProps<TItem>) {
    return (
        <div className="flex flex-col gap-2 sm:flex-row">
            {filters && <GalleryFilters filters={filters()} />}
            <Stack spacing={4} className="w-full">
                {gridFilters && (
                    <GalleryGridFilter
                        header={gridHeader}
                        filters={gridFilters}
                    />
                )}
                <GalleryGrid items={items} itemComponent={itemComponent} />
            </Stack>
        </div>
    );
}
