'use client';

import { FileText } from "lucide-react";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import type { getEntityTypes } from "@gredice/storage";
import Link from "next/link";

export type EntityTypesListProps = {
    entityTypes: Awaited<ReturnType<typeof getEntityTypes>>;
    createEntityType: (entityTypeName: string, label: string) => Promise<void>;
};

export function EntityTypesList({ entityTypes }: EntityTypesListProps) {
    return (
        <>
            {entityTypes.map(entityType => (
                <Link key={entityType.id} href={`/admin/directories/${entityType.name}`}>
                    <ListItem
                        label={entityType.label}
                        startDecorator={<FileText className="size-5" />} />
                </Link>
            ))}
        </>
        // <Stack className="min-w-56">
        //     <ListHeader header="Tipovi zapisa"
        //         actions={[
        //             <IconButton key="add" onClick={async () => await createEntityType('new', 'Novi tip zapisa')}>
        //                 <Add />
        //             </IconButton>
        //         ]}
        //     />
        //     <List>
        //         {entityTypes.map(entityType => (
        //             <ListItem
        //                 key={entityType.id}
        //                 nodeId={entityType.id.toString()}
        //                 label={entityType.label}
        //                 startDecorator={<File className="size-5" />}
        //                 selected={pathname.startsWith('/admin/directories/' + entityType.name)}
        //                 onSelected={handleSelection} />
        //         ))}
        //     </List>
        // </Stack>
    );
}
