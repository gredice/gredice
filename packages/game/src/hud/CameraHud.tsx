import { IconButton } from "@signalco/ui-primitives/IconButton";
import { useGameState } from "../useGameState";
import { Row } from "@signalco/ui-primitives/Row";
import { Redo, Undo } from "lucide-react";

export function CameraHud() {
    const worldRotate = useGameState(state => state.worldRotate);
    return (
        <Row className="pointer-events-auto">
            <IconButton title="Okreni lijevo" variant='plain' className='hover:bg-muted' onClick={worldRotate.bind(null, 'ccw')}>
                <Undo className='size-5' />
            </IconButton>
            <IconButton title="Okreni desno" variant='plain' className='hover:bg-muted' onClick={worldRotate.bind(null, 'cw')}>
                <Redo className='size-5' />
            </IconButton>
        </Row>
    )
}