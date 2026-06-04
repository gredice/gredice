'use client';

import { Button } from '@gredice/ui/Button';
import { ButtonGroup, buttonGroupItemClassName } from '@gredice/ui/ButtonGroup';
import { Add, Channel, Down, FileText } from '@gredice/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { KnownPages } from '../../../../src/KnownPages';

export function CmsPageCreateDropdownButton() {
    return (
        <ButtonGroup legend="Kreiranje CMS stranice" size="md">
            <Button
                href={KnownPages.CmsPageCreate}
                size="md"
                startDecorator={<Add className="size-4 shrink-0" />}
                className={buttonGroupItemClassName({
                    size: 'md',
                    className: 'rounded-r-none pr-3',
                })}
            >
                Nova stranica
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        size="md"
                        aria-label="Odaberi vrstu CMS stranice"
                        title="Odaberi vrstu CMS stranice"
                        className={buttonGroupItemClassName({
                            iconOnly: true,
                            size: 'md',
                            className:
                                'rounded-l-none border-l border-primary-foreground/20',
                        })}
                    >
                        <Down className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
                </DropdownMenuContent>
            </DropdownMenu>
        </ButtonGroup>
    );
}
