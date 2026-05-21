'use client';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { useContext } from 'react';
import { KnownPages } from '../../../src/KnownPages';
import { EntityTypeIcon } from '../directories/EntityTypeIcon';
import { AdminBreadcrumbSelectorTrigger } from './AdminBreadcrumbSelectorTrigger';
import {
    findDirectoryBreadcrumbEntityType,
    findDirectoryBreadcrumbGroup,
    getDirectoryBreadcrumbGroups,
} from './directoryBreadcrumbGroups';
import { NavContext } from './NavContext';

export function AdminDirectoryEntityTypeBreadcrumbSelector({
    entityTypeName,
    fallbackLabel,
}: {
    entityTypeName: string;
    fallbackLabel?: string;
}) {
    const navContext = useContext(NavContext);
    const groups = getDirectoryBreadcrumbGroups(navContext);
    const currentGroup = findDirectoryBreadcrumbGroup(groups, entityTypeName);
    const currentEntityType = findDirectoryBreadcrumbEntityType(
        groups,
        entityTypeName,
    );

    if (!currentEntityType) {
        return fallbackLabel ?? entityTypeName;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <AdminBreadcrumbSelectorTrigger>
                    {currentEntityType.label}
                </AdminBreadcrumbSelectorTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                {(currentGroup?.entityTypes ?? [currentEntityType]).map(
                    (entityType) => (
                        <DropdownMenuItem
                            key={entityType.id}
                            href={KnownPages.DirectoryEntityType(
                                entityType.name,
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <EntityTypeIcon
                                    icon={entityType.icon}
                                    className="size-4"
                                />
                                <span>{entityType.label}</span>
                            </div>
                        </DropdownMenuItem>
                    ),
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
