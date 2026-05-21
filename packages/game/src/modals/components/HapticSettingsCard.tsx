import { Card, CardContent } from '@gredice/ui/Card';
import { Checkbox } from '@gredice/ui/Checkbox';
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
