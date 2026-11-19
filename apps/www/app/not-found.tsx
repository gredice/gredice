import { Button } from '@gredice/ui/Button';
import { Search } from '@gredice/ui/icons';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { SunflowerMascot3D } from '@gredice/ui/SunflowerVisuals';
import { Typography } from '@gredice/ui/Typography';

export default function NotFound() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center py-16">
            <div className="flex gap-8 md:flex-row flex-col items-center text-center md:text-left">
                <SunflowerMascot3D
                    expression="sad"
                    className="size-[200px] shrink-0"
                    width={200}
                    height={200}
                />
                <Stack spacing={4}>
                    <Typography level="h1">Nepoznata stranica</Typography>
                    <Typography level="body1">
                        Oprosti, ali stranica koju tražiš ne postoji. Možda je
                        premještena ili obrisana.
                    </Typography>
                    <Row
                        spacing={3}
                        className="flex-wrap justify-center md:justify-start"
                    >
                        <NavigatingButton href="/">
                            Idi na početnu stranicu
                        </NavigatingButton>
                        <Button
                            href="/pretraga"
                            color="neutral"
                            variant="outlined"
                            className="bg-background text-primary"
                            startDecorator={
                                <Search aria-hidden className="size-4" />
                            }
                        >
                            Pretraži Gredice
                        </Button>
                    </Row>
                </Stack>
            </div>
        </div>
    );
}
