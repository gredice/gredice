'use client';

import { Add, Channel, FileText } from '@gredice/ui/icons';
import { DropdownMenuItem } from '@gredice/ui/Menu';
import { SplitButton } from '@gredice/ui/SplitButton';
import { KnownPages } from '../../../../src/KnownPages';

export function CmsPageCreateDropdownButton() {
    return (
        <SplitButton
            dropdownLabel="Odaberi vrstu CMS stranice"
            href={KnownPages.CmsPageCreate}
            menuContent={
                <>
                    <DropdownMenuItem
                        href={KnownPages.CmsPageCreateTemplate('blog')}
                        startDecorator={<FileText className="size-4" />}
                    >
                        Blog objava
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        href={KnownPages.CmsPageCreateTemplate('changelog')}
                        startDecorator={<Channel className="size-4" />}
                    >
                        Changelog zapis
                    </DropdownMenuItem>
                </>
            }
            size="md"
            startDecorator={<Add className="size-4 shrink-0" />}
        >
            Nova stranica
        </SplitButton>
    );
}
