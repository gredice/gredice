import { Chip } from '@gredice/ui/Chip';
import { Verified } from '@gredice/ui/icons';
import { Popper } from '@gredice/ui/Popper';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';

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
            <Stack spacing={4}>
                <Row spacing={4}>
                    <Verified className="size-10 text-secondary-foreground" />
                    <Typography level="body2" semiBold>
                        &quot;Odobreno&quot; označava da su informacije
                        provjerene.
                    </Typography>
                </Row>
                <Stack spacing={2}>
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
