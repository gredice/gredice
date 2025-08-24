import { Redo, Undo } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Row } from '@signalco/ui-primitives/Row';
import { useGameState } from '../useGameState';

export function CameraHud() {
    const worldRotate = useGameState((state) => state.worldRotate);
    return (
        <Row className="pointer-events-auto">
            <IconButton
                title="Okreni lijevo"
                variant="plain"
                className="hover:bg-muted"
                onClick={worldRotate.bind(null, 'ccw')}
            >
                <Undo className="size-5" />
            </IconButton>
            <IconButton
                title="Okreni desno"
                variant="plain"
                className="hover:bg-muted"
                onClick={worldRotate.bind(null, 'cw')}
            >
                <Redo className="size-5" />
            </IconButton>
        </Row>
    );
}
