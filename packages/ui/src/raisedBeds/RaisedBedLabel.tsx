import { Tally3 } from '@signalco/ui-icons';
import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';

export function RaisedBedLabel({ physicalId }: { physicalId: string | null }) {
    if (!physicalId) {
        return <Typography level="body2">Nema fizičke oznake</Typography>;
    }

    return (
        <Row spacing={1}>
            <Tally3 className="size-5 rotate-90 mt-1" />
            <Typography level="h5" component="p">
                <strong>Gr {physicalId}</strong>
            </Typography>
        </Row>
    );
}
