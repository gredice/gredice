import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';
import { RaisedBedIcon } from '../RaisedBedIcon';

export function RaisedBedLabel({ physicalId }: { physicalId: string | null }) {
    if (!physicalId) {
        return <Typography level="body2">Nema fizičke oznake</Typography>;
    }

    return (
        <Row spacing={1} className="items-center">
            <RaisedBedIcon className="size-5 shrink-0" />
            <Typography level="h5" component="p">
                <strong>Gr {physicalId}</strong>
            </Typography>
        </Row>
    );
}
