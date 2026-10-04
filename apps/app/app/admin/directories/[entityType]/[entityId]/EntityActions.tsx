'use client';

import type { SelectEntity } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import {
    Delete,
    Edit,
    ExternalLink,
    Megaphone,
    MoreHorizontal,
} from '@gredice/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { Row } from '@gredice/ui/Row';
import Link from 'next/link';
import { startTransition, useState } from 'react';
import { KnownPages } from '../../../../../src/KnownPages';
import { updateEntityStateAction } from '../../../../(actions)/entityActions';
import { useEntityDetailsSave } from './EntityDetailsSaveContext';

export function EntityActions({
    entity,
    entityType,
    importAction,
    deleteAction,
}: {
    entity: SelectEntity;
    entityType: string;
    importAction: (formData: FormData) => Promise<void>;
    deleteAction: () => Promise<void>;
}) {
    const [state, setState] = useState(entity.state);
    const [publishError, setPublishError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { trackSave } = useEntityDetailsSave();

    async function changeState(newState: string) {
        const previousState = state;
        setState(newState);
        setPublishError(null);
        try {
            await trackSave(async () => {
                const result = await updateEntityStateAction({
                    id: entity.id,
                    state: newState,
                });
                if (!result.success) {
                    throw new Error(
                        result.message ?? 'Promjena statusa nije uspjela.',
                    );
                }
            });
        } catch (error) {
            setState(previousState);
            setPublishError(
                error instanceof Error
                    ? error.message
                    : 'Promjena statusa nije uspjela.',
            );
        }
    }

    function handleDelete(event: Event) {
        event.preventDefault();
        setIsDeleting(true);
        startTransition(async () => {
            try {
                await deleteAction();
            } catch (error) {
                console.error('Failed to delete entity', error);
                setIsDeleting(false);
            }
        });
    }

    const isPublished = state === 'published';

    return (
        <Row spacing={2} className="items-center">
            {publishError && (
                <span className="text-sm text-red-600">{publishError}</span>
            )}
            <Link
                href={KnownPages.DirectoryEntityPreview(entityType, entity.id)}
                target="_blank"
            >
                <Button
                    variant="outlined"
                    size="sm"
                    startDecorator={<ExternalLink className="size-4" />}
                >
                    Preview
                </Button>
            </Link>
            {!isPublished && (
                <Button
                    variant="solid"
                    size="sm"
                    startDecorator={<Megaphone className="size-4" />}
                    onClick={() => changeState('published')}
                >
                    Objavi
                </Button>
            )}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <IconButton variant="plain" title="Više opcija">
                        <MoreHorizontal className="size-5" />
                    </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                    {isPublished && (
                        <>
                            <DropdownMenuLabel className="text-muted-foreground text-xs">
                                Status
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                                onSelect={() => changeState('draft')}
                                startDecorator={
                                    <Edit className="size-4 shrink-0" />
                                }
                            >
                                Vrati u izradu
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                    )}
                    <DropdownMenuLabel className="text-muted-foreground text-xs">
                        Uvoz podataka
                    </DropdownMenuLabel>
                    <div className="px-2 pb-2 pt-1">
                        <form
                            action={importAction}
                            method="post"
                            encType="multipart/form-data"
                            className="space-y-3"
                        >
                            <Input
                                type="file"
                                name="entityJson"
                                accept="application/json"
                                required
                            />
                            <Button
                                type="submit"
                                className="w-full justify-center"
                            >
                                Uvezi
                            </Button>
                        </form>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onSelect={handleDelete}
                        disabled={isDeleting}
                        className="text-red-600 focus:bg-red-50 focus:text-red-700"
                    >
                        <Row spacing={2} className="items-center">
                            <Delete className="size-4 shrink-0" />
                            <span>{isDeleting ? 'Brisanje...' : 'Obriši'}</span>
                        </Row>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </Row>
    );
}
