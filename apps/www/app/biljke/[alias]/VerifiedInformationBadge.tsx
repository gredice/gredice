import { Verified } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Popper } from '@signalco/ui-primitives/Popper';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';

export function VerifiedInformationBadge() {
    return (
        <Popper
            trigger={
                <button type="button">
                    <Chip
                        color="success"
                        className="cursor-default hover:bg-lime-400"
                    >
                        <Verified className="size-4" />
                        <span>Odobreno</span>
                    </Chip>
                </button>
            }
            className="p-6 min-w-96"
        >
            <Stack spacing={2}>
                <Row spacing={2}>
                    <Verified className="size-10 text-secondary-foreground" />
                    <Typography level="body2" semiBold>
                        &quot;Odobreno&quot; označava da su informacije
                        provjerene.
                    </Typography>
                </Row>
                <Stack spacing={1}>
                    <Typography>
                        Da bismo osigurali točnost podataka, naši stručnjaci
                        provjeravaju sve informacije jednu po jednu.
                    </Typography>
                    <Typography>
                        Zelena kvačica označava da su informacije o biljci
                        provjerene i ocijenjene kao ispravne.
                    </Typography>
                </Stack>
            </Stack>
        </Popper>
    );
}