'use client';

import { MoreHorizontal } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@signalco/ui-primitives/Menu';

export function EntityImportMenu({
    importAction,
}: {
    importAction: (formData: FormData) => Promise<void>;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <IconButton variant="plain" title="Više opcija">
                    <MoreHorizontal className="size-5" />
                </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-4">
                <form
                    action={importAction}
                    method="post"
                    encType="multipart/form-data"
                    className="space-y-3"
                >
                    <Input
                        label="Uvoz podataka"
                        type="file"
                        name="entityJson"
                        accept="application/json"
                        required
                    />
                    <Button type="submit" className="w-full justify-center">
                        Uvezi
                    </Button>
                </form>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
