import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { useState } from 'react';
import {
    canVibrate,
    isHapticDisabled,
    setHapticDisabled,
} from '../../utils/haptics';

export function HapticSettingsCard() {
    const [disabled, setDisabled] = useState(isHapticDisabled);

    if (!canVibrate()) {
        return null;
    }

    const handleChange = (checked: boolean) => {
        setHapticDisabled(!checked);
        setDisabled(!checked);
    };

    return (
        <Card>
            <CardContent noHeader>
                <Checkbox
                    label="Vibracija"
                    checked={!disabled}
                    onCheckedChange={handleChange}
                />
            </CardContent>
        </Card>
    );
}
