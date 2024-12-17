import { getEntityTypes } from "@gredice/storage";
import { EntityTypesListItem } from "./EntityTypesListItem";
import { EntityTypeCreateModal } from "./EntityTypeCreateModal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { List, ListHeader } from "@signalco/ui-primitives/List";

export async function EntityTypesList() {
    const entityTypes = await getEntityTypes();
    return (
        <>
            <Stack spacing={1}>
                <ListHeader
                    header="Zapisi"
                    actions={[
                        <EntityTypeCreateModal />
                    ]}
                />
                <List>
                    {entityTypes.map(entityType => (
                        <EntityTypesListItem
                            key={entityType.id}
                            entityType={entityType} />
                    ))}
                </List>
            </Stack>
        </>
    );
}
