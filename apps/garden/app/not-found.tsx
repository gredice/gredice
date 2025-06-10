import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { NavigatingButton } from "@signalco/ui/NavigatingButton";
import Image from "next/image";

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <div className="flex gap-8 md:flex-row flex-col items-center text-center md:text-left">
                <Image
                    src="https://cdn.gredice.com/sunflower-sad-500x500.png"
                    alt="Tužan suncokret"
                    width={200}
                    height={200} />
                <Stack spacing={2}>
                    <Typography level="h1">Nepoznata stranica</Typography>
                    <Typography level="body1">
                        Oprosti, ali stranica koju tražiš ne postoji. Možda je premještena ili obrisana.
                    </Typography>
                    <Row className="justify-center md:justify-start">
                        <NavigatingButton href="/">
                            Idi na početnu stranicu
                        </NavigatingButton>
                    </Row>
                </Stack>
            </div>
        </div>
    );
}