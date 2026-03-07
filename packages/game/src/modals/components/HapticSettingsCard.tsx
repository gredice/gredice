import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { useState } from 'react';
import { isHapticDisabled, setHapticDisabled } from '../../utils/haptics';

export function HapticSettingsCard() {
    const [disabled, setDisabled] = useState(isHapticDisabled);

    const handleChange = (checked: boolean) => {
        setHapticDisabled(!checked);
        setDisabled(!checked);
    };

    return (
        <Card>
            <CardContent className="pt-6">
                <Checkbox
                    label="Vibracija"
                    checked={!disabled}
                    onCheckedChange={handleChange}
                />
            </CardContent>
        </Card>
    );
}
