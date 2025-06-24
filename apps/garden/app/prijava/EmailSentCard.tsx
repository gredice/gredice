import { Button } from "@signalco/ui-primitives/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@signalco/ui-primitives/Card";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Mail } from "@signalco/ui-icons";

export function EmailSentCard() {
    return (
        <Card className="w-[350px] p-12">
            <CardHeader>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#2f6e40] mx-auto mb-4">
                    <Mail className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-center">Email poslan</CardTitle>
            </CardHeader>
            <CardContent>
                <Stack spacing={3}>
                    <Typography center semiBold className="text-[#2f6e40]">
                        Provjeri svoj email za nastavak promjene zaporke
                    </Typography>
                    <Typography level="body3" center>
                        Poslali smo ti link za promjene zaporke na tvoju email adresu. Molimo te provjeri svoj inbox i slijedi upute za promjenu zaporke.
                    </Typography>
                    <Button href="/" fullWidth variant='soft'>
                        Povratak
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
}