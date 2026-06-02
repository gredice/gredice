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
import { AdminBreadcrumbSelectorLink } from './AdminBreadcrumbSelectorLink';
import { AdminBreadcrumbSelectorTrigger } from './AdminBreadcrumbSelectorTrigger';
import {
    findDirectoryBreadcrumbGroup,
    getDirectoryBreadcrumbGroups,
} from './directoryBreadcrumbGroups';
import { NavContext } from './NavContext';

export function AdminDirectoryCategoryBreadcrumbSelector({
    entityTypeName,
}: {
    entityTypeName: string;
}) {
    const navContext = useContext(NavContext);
    const groups = getDirectoryBreadcrumbGroups(navContext);
    const currentGroup = findDirectoryBreadcrumbGroup(groups, entityTypeName);

    if (!currentGroup) {
        return null;
    }

    const firstCurrentGroupEntityType = currentGroup.entityTypes[0];
    const currentGroupHref = firstCurrentGroupEntityType
        ? KnownPages.DirectoryEntityType(firstCurrentGroupEntityType.name)
        : KnownPages.Directories;

    return (
        <span className="inline-flex min-w-0 items-center gap-0.5">
            <AdminBreadcrumbSelectorLink href={currentGroupHref}>
                {currentGroup.label}
            </AdminBreadcrumbSelectorLink>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <AdminBreadcrumbSelectorTrigger
                        aria-label={`Prikaži podizbornik za ${currentGroup.label}`}
                    />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {groups.map((group) => {
                        const firstEntityType = group.entityTypes[0];
                        if (!firstEntityType) {
                            return null;
                        }

                        return (
                            <DropdownMenuItem
                                key={group.key}
                                href={KnownPages.DirectoryEntityType(
                                    firstEntityType.name,
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <EntityTypeIcon
                                        icon={group.icon}
                                        className="size-4"
                                    />
                                    <span>{group.label}</span>
                                </div>
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenu>
        </span>
    );
}
