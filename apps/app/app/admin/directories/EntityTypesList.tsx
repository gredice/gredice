'use client';

import { File } from "lucide-react";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { List, ListHeader } from "@signalco/ui-primitives/List";
import { usePathname, useRouter } from "next/navigation";
import type { getEntityTypes } from "@gredice/storage";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Add } from "@signalco/ui-icons";
import { Stack } from "@signalco/ui-primitives/Stack";

export function EntityTypesList({ entityTypes, createEntityType }: { entityTypes: Awaited<ReturnType<typeof getEntityTypes>>, createEntityType: (entityTypeName: string, label: string) => Promise<void> }) {
    const pathname = usePathname();
    const router = useRouter();

    const handleSelection = (nodeId: string) => {
        router.push('/admin/directories/' + entityTypes.find(entityType => entityType.id.toString() === nodeId)?.name);
    }

    return (
        <Stack className="min-w-56">
            <ListHeader header="Tipovi zapisa"
                actions={[
                    <IconButton key="add" onClick={async () => await createEntityType('new', 'Novi tip zapisa')}>
                        <Add />
                    </IconButton>
                ]}
            />
            <List>
                {entityTypes.map(entityType => (
                    <ListItem
                        key={entityType.id}
                        nodeId={entityType.id.toString()}
                        label={entityType.label}
                        startDecorator={<File className="size-5" />}
                        selected={pathname.startsWith('/admin/directories/' + entityType.name)}
                        onSelected={handleSelection} />
                ))}
            </List>
        </Stack>
    );
}
