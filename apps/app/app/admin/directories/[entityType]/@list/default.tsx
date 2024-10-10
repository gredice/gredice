import { EntitiesTable } from "./EntitiesTable";

export const dynamic = 'force-dynamic';

export default function EntityTypesListDefault({ params }: { params: { entityType: string } }) {
    return (
        <EntitiesTable entityType={params.entityType} />
    );
}