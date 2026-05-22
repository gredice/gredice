import { IconButton } from '@gredice/ui/IconButton';
import { Add, Remove } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';

export function PortionPicker({
    value,
    onChange,
}: {
    value: number;
    onChange: (newValue: number) => void;
}) {
    return (
        <Row spacing={4}>
            <IconButton
                title="Smanji broj porcija"
                onClick={() => onChange(Math.max(1, value - 1))}
                variant="outlined"
                className="rounded-full"
                size="sm"
                disabled={value <= 1}
            >
                <Remove />
            </IconButton>
            {value} {value === 1 || value > 4 ? 'porcija' : 'porcije'}
            <IconButton
                title="Povećaj broj porcija"
                onClick={() => onChange(value + 1)}
                variant="outlined"
                size="sm"
                className="rounded-full"
            >
                <Add />
            </IconButton>
        </Row>
    );
}
