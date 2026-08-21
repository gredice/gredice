import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Modal } from '@gredice/ui/Modal';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Popper } from '@gredice/ui/Popper';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { useState } from 'react';

export function MobileModalForm() {
    return (
        <Modal mobileOverride open title="Uredi podatke">
            <Input fullWidth label="Naziv" />
        </Modal>
    );
}

export function ModalInteractionStory({
    dismissible = true,
    mobileOverride,
}: {
    dismissible?: boolean;
    mobileOverride?: boolean;
}) {
    const [selection, setSelection] = useState<string>();

    return (
        <>
            <Modal
                description="Provjera zatvaranja, fokusa i ugniježđenih kontrola."
                dismissible={dismissible}
                mobileOverride={mobileOverride}
                title="Postavke prikaza"
                trigger={<Button>Otvori postavke</Button>}
            >
                <Stack spacing={4}>
                    <Popper trigger={<Button>Otvori pomoć</Button>}>
                        Dodatne postavke prikaza
                    </Popper>
                    <SelectItems
                        items={[
                            { value: 'compact', label: 'Kompaktno' },
                            { value: 'comfortable', label: 'Udobno' },
                        ]}
                        label="Gustoća prikaza"
                        onValueChange={setSelection}
                        value={selection}
                    />
                    <div aria-hidden className="h-[48rem] rounded-md border" />
                    <Button>Završna radnja</Button>
                </Stack>
            </Modal>
            <output aria-label="Odabrana gustoća">{selection}</output>
        </>
    );
}

export function ModalConfirmInteractionStory() {
    const [confirmed, setConfirmed] = useState(false);

    return (
        <>
            <ModalConfirm
                expectedConfirm="IZBRIŠI"
                header="Obrisati zapis?"
                onConfirm={() => setConfirmed(true)}
                promptLabel='Upiši "IZBRIŠI" za potvrdu'
                title="Potvrda brisanja"
                trigger={<Button color="danger">Obriši zapis</Button>}
            >
                Ova radnja se ne može poništiti.
            </ModalConfirm>
            <output aria-label="Rezultat potvrde">
                {confirmed ? 'potvrđeno' : 'nije potvrđeno'}
            </output>
        </>
    );
}
