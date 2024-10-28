import { BookA, FileText } from "lucide-react";
import { type getEntityTypes } from "@gredice/storage";
import Link from "next/link";
import { ListTreeItem } from "@signalco/ui-primitives/ListTreeItem";
import { KnownPages } from "../../src/KnownPages";

export type EntityTypesListProps = {
    entityTypes: Awaited<ReturnType<typeof getEntityTypes>>;
    createEntityType: (entityTypeName: string, label: string) => Promise<void>;
};

async function EntityTypeListeItem({ entityType }: { entityType: Awaited<ReturnType<typeof getEntityTypes>>[0] }) {
    return (
        <Link key={entityType.id} href={KnownPages.DirectoryEntityType(entityType.name)} passHref legacyBehavior>
            <ListTreeItem
                label={entityType.label}
                startDecorator={<FileText className="size-5" />}>
                <Link href={KnownPages.DirectoryEntityTypeAttributeDefinitions(entityType.name)} passHref legacyBehavior>
                    <ListTreeItem label="Atributi" startDecorator={(<BookA className="size-5" />)} />
                </Link>
            </ListTreeItem>
        </Link>
    );
}

export function EntityTypesList({ entityTypes }: EntityTypesListProps) {
    return (
        <>
            {entityTypes.map(entityType => (
                <EntityTypeListeItem
                    key={entityType.id}
                    entityType={entityType} />
            ))}
        </>
    );
}
