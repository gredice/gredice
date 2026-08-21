import { Button } from '@gredice/ui/Button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { Modal } from '@gredice/ui/Modal';
import { Popper } from '@gredice/ui/Popper';
import { Stack } from '@gredice/ui/Stack';
import { Tooltip, TooltipContent, TooltipTrigger } from '@gredice/ui/Tooltip';
import { useState } from 'react';

export function BaseUiOverlayIntegrationStory() {
    const [lastAction, setLastAction] = useState('none');

    return (
        <Stack className="p-8" spacing={4}>
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <Button variant="outlined">Fokusiraj savjet</Button>
                </TooltipTrigger>
                <TooltipContent>Tipkovnički savjet</TooltipContent>
            </Tooltip>

            <Popper
                aria-label="Detalji prikaza"
                onEscapeKeyDown={() => setLastAction('escape')}
                role="dialog"
                trigger={<Button variant="outlined">Otvori detalje</Button>}
            >
                <Stack className="p-3" spacing={2}>
                    <label htmlFor="overlay-note">Napomena</label>
                    <input id="overlay-note" className="border" />
                </Stack>
            </Popper>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outlined">Otvori izbornik</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => setLastAction('edit')}>
                        Uredi
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>Nedostupno</DropdownMenuItem>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            Više opcija
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem
                                onSelect={() => setLastAction('duplicate')}
                            >
                                Dupliciraj
                            </DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem
                        href="#overlay-target"
                        onClick={() => setLastAction('link')}
                    >
                        Otvori odjeljak
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <div id="overlay-target">Ciljni odjeljak</div>
            <output aria-label="Zadnja radnja">{lastAction}</output>
        </Stack>
    );
}

export function ResponsiveModalIntegrationStory() {
    return (
        <Modal
            description="Opis koji povezuje pristupačni naziv i sadržaj."
            title="Provjera responzivnog modala"
            trigger={<Button>Otvori responzivni modal</Button>}
        >
            <Button>Primarna radnja</Button>
        </Modal>
    );
}
