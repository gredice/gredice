import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Mail } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';

type RegistrationSuccessfulPageProps = {
    searchParams?: Promise<{
        upgrade?: string | string[];
    }>;
};

function firstParamValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

export default async function RegistrationSuccessfulPage({
    searchParams,
}: RegistrationSuccessfulPageProps) {
    const params = await searchParams;
    const isUpgrade = firstParamValue(params?.upgrade) === '1';
    const title = isUpgrade
        ? 'Provjeri email za spremanje vrta'
        : 'Registracija uspješna';
    const highlight = isUpgrade
        ? 'Tvoj vrt, košara i favoriti su spremljeni'
        : 'Provjeri svoj email za nastavak registracije';
    const description = isUpgrade
        ? 'Poslali smo ti poveznicu za potvrdu registracije. Nakon potvrde možeš se vratiti u vrt i nastaviti s plaćanjem.'
        : 'Poslali smo ti poveznicu za potvrdu registracije na tvoju email adresu. Molimo te provjeri svoj inbox i klikni na poveznicu kako bi potvrdili tvoj email.';
    const buttonLabel = isUpgrade ? 'Vrati se u vrt' : 'Povratak';

    return (
        <div className="flex items-center justify-center min-h-screen">
            <Card className="w-[350px] p-12">
                <CardHeader>
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#2f6e40] mx-auto mb-4">
                        <Mail className="size-6 text-white" />
                    </div>
                    <CardTitle className="text-center">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={6}>
                        <Typography center semiBold className="text-[#2f6e40]">
                            {highlight}
                        </Typography>
                        <Typography level="body3" center>
                            {description}
                        </Typography>
                        <Button href="/" fullWidth variant="soft">
                            {buttonLabel}
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        </div>
    );
}
