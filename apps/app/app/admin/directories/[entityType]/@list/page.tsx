import { EntitiesTable } from "./EntitiesTable";

export const dynamic = 'force-dynamic';

export default function EntityTypesListPage({ params }: { params: { entityType: string } }) {
    return (
        <EntitiesTable entityType={params.entityType} />
    );
}