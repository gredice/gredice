'use client';

import { type getEntityTypes } from "@gredice/storage";
import { FileText } from "@signalco/ui-icons";
import { EntityTypesListItem } from "./EntityTypesListItem";
import { ListTreeItem } from "@signalco/ui-primitives/ListTreeItem";
import { usePathname } from "next/navigation";
import { KnownPages } from "../../src/KnownPages";
import { EntityTypeCreateModal } from "./EntityTypeCreateModal";

export type EntityTypesListProps = {
    entityTypes: Awaited<ReturnType<typeof getEntityTypes>>;
};

export function EntityTypesList({ entityTypes }: EntityTypesListProps) {
    const pathname = usePathname();
    const isDirectoriesSelected = pathname.startsWith(KnownPages.Directories);

    return (
        <>
            <ListTreeItem
                label="Zapisi"
                startDecorator={<FileText className="size-5" />}
                defaultOpen={isDirectoriesSelected}>
                {entityTypes.map(entityType => (
                    <EntityTypesListItem
                        key={entityType.id}
                        entityType={entityType} />
                ))}
                <EntityTypeCreateModal />
            </ListTreeItem>
        </>
    );
}
