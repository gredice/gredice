import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { SurveyDefinitionForm } from './SurveyDefinitionForm';
import { SurveyWorkspaceShell } from './SurveyWorkspaceShell';

export function SurveyCreateView() {
    return (
        <SurveyWorkspaceShell view="create">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <Card>
                    <CardHeader>
                        <CardTitle>Nova anketa</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <SurveyDefinitionForm />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Upute za objavu</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Stack spacing={2}>
                            <Typography level="body2">
                                Objavljena verzija se ne uređuje izravno.
                                Promjene idu kroz novu verziju kako bi stari
                                odgovori ostali vezani uz pitanje koje je
                                korisnik vidio.
                            </Typography>
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Priprema dostavne ankete stvara trenutni set
                                pitanja i objavljuje ga ako još ne postoji.
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
            </div>
        </SurveyWorkspaceShell>
    );
}
