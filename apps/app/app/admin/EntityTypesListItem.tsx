'use client';

import { getEntityTypes } from "@gredice/storage";
import { ListTreeItem } from "@signalco/ui-primitives/ListTreeItem";
import { FileText, BookA } from "lucide-react";
import { KnownPages } from "../../src/KnownPages";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function EntityTypesListItem({ entityType }: { entityType: Awaited<ReturnType<typeof getEntityTypes>>[0] }) {
    const pathname = usePathname();
    const isSelected = pathname === KnownPages.DirectoryEntityType(entityType.name);

    return (
        <Link href={KnownPages.DirectoryEntityType(entityType.name)} passHref legacyBehavior>
            <ListTreeItem
                nodeId={entityType.id.toString()}
                selected={isSelected}
                onSelected={() => { }}
                label={entityType.label}
                startDecorator={<FileText className="size-5" />}>
                <Link href={KnownPages.DirectoryEntityTypeAttributeDefinitions(entityType.name)} passHref legacyBehavior>
                    <ListTreeItem label="Atributi" startDecorator={(<BookA className="size-5" />)} />
                </Link>
            </ListTreeItem>
        </Link>
    );
}