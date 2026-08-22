import { Card, CardContent } from '@gredice/ui/Card';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';

const residents = [
    {
        name: 'Ptice',
        sound: 'Cvrk-cvrk!',
        description:
            'Ptice slijeću na krošnje i kućice za ptice, a pas ih rado potjera dok ih mačka strpljivo vreba.',
    },
    {
        name: 'Pčele',
        sound: 'Bzzz!',
        description:
            'Pčele dolaze same kad u vrtu ima cvijeta — na gredicama, tulipanima, suncokretima ili kaktusima. Lete samo po sunčanom i mirnom danu.',
    },
] satisfies Array<{ name: string; sound: string; description: string }>;

export function OtherGardenResidents() {
    return (
        <Stack spacing={3}>
            <Stack spacing={1}>
                <Typography component="h2" level="h5">
                    Ostali stanovnici vrta
                </Typography>
                <Typography level="body2" secondary>
                    Ove životinje ne trebaju svoj blok — dolaze same kad im vrt
                    ponudi ono što traže.
                </Typography>
            </Stack>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {residents.map((resident) => (
                    <Card
                        className="h-full border-tertiary border-b-4"
                        key={resident.name}
                    >
                        <CardContent noHeader>
                            <Stack spacing={1}>
                                <Row spacing={2}>
                                    <Typography
                                        component="h3"
                                        level="body1"
                                        semiBold
                                    >
                                        {resident.name}
                                    </Typography>
                                    <Typography level="body3" secondary>
                                        {resident.sound}
                                    </Typography>
                                </Row>
                                <Typography level="body2" secondary>
                                    {resident.description}
                                </Typography>
                            </Stack>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </Stack>
    );
}
