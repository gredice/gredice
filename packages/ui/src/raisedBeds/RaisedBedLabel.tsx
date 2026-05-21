import { RaisedBedIcon } from '../RaisedBedIcon';
import { Row } from '../Row';
import { Typography } from '../Typography';

export function RaisedBedLabel({ physicalId }: { physicalId: string | null }) {
    if (!physicalId) {
        return <Typography level="body2">Nema fizičke oznake</Typography>;
    }

    return (
        <Row spacing={1} className="items-center">
            <RaisedBedIcon
                className="size-6 shrink-0"
                physicalId={physicalId}
            />
            <Typography level="h5" component="p">
                <strong>Gr {physicalId}</strong>
            </Typography>
        </Row>
    );
}
