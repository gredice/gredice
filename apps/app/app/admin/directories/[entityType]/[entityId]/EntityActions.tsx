'use client';

import type { SelectEntity } from '@gredice/storage';
import { Delete, Edit, Megaphone, MoreHorizontal } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@signalco/ui-primitives/Menu';
import { Row } from '@signalco/ui-primitives/Row';
import { startTransition, useState } from 'react';
import { updateEntity } from '../../../../(actions)/entityActions';
import { useEntityDetailsSave } from './EntityDetailsSaveContext';

export function EntityActions({
    entity,
    importAction,
    deleteAction,
}: {
    entity: SelectEntity;
    importAction: (formData: FormData) => Promise<void>;
    deleteAction: () => Promise<void>;
}) {
    const [state, setState] = useState(entity.state);
    const [isDeleting, setIsDeleting] = useState(false);
    const { trackSave } = useEntityDetailsSave();

    async function changeState(newState: string) {
        setState(newState);
        await trackSave(() =>
            updateEntity({
                id: entity.id,
                state: newState,
            }),
        );
    }

    function handleDelete(event: Event) {
        event.preventDefault();
        setIsDeleting(true);
        startTransition(deleteAction);
    }

    const isPublished = state === 'published';

    return (
        <Row spacing={1} className="items-center">
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
                        <Row spacing={1} className="items-center">
                            <Delete className="size-4 shrink-0" />
                            <span>{isDeleting ? 'Brisanje...' : 'Obriši'}</span>
                        </Row>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </Row>
    );
}
