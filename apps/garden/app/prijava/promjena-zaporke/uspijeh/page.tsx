import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Password } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';

export default function RegistrationSuccessfulPage() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <Card className="w-[350px] p-12">
                <CardHeader>
                    <div className="flex items-center justify-center size-12 rounded-full bg-[#2f6e40] mx-auto mb-4">
                        <Password className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-center">
                        Promjena zaporke uspješna
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={6}>
                        <Typography level="body2" center>
                            Možeš se prijaviti s novom zaporkom.
                        </Typography>
                        <Button href="/" fullWidth variant="soft">
                            Prijava
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        </div>
    );
}
