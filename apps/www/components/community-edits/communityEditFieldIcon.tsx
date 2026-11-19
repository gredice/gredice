import {
    ArrowDownToLine,
    Droplet,
    Leaf,
    Ruler,
    ShoppingCart,
    Sprout,
    Store,
    Sun,
    SunMoon,
    Tally3,
    Thermometer,
    Timer,
} from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';
import type { CommunityEditableField } from './communityEditFields';

const attributeIconClassName = 'size-4';

/** Icon that matches the attribute card of the same field on the public page. */
export function attributeFieldIcon(field: CommunityEditableField): ReactNode {
    switch (field.fieldKey) {
        case 'plant.seeding-distance':
        case 'plant.seeding-distance-min':
        case 'plant.seeding-distance-max':
            return <Ruler aria-hidden className={attributeIconClassName} />;
        case 'plant.seeding-depth':
            return (
                <ArrowDownToLine
                    aria-hidden
                    className={attributeIconClassName}
                />
            );
        case 'plant.germination-type':
            return <Sprout aria-hidden className={attributeIconClassName} />;
        case 'plant.germination-temperature':
            return (
                <Thermometer aria-hidden className={attributeIconClassName} />
            );
        case 'plant.germination-window-min':
        case 'plant.germination-window-max':
            return <Timer aria-hidden className={attributeIconClassName} />;
        case 'plant.light':
            return <Sun aria-hidden className={attributeIconClassName} />;
        case 'plant.soil':
            return (
                <Tally3
                    aria-hidden
                    className={cx(attributeIconClassName, 'rotate-90')}
                />
            );
        case 'plant.nutrients':
            return <Leaf aria-hidden className={attributeIconClassName} />;
        case 'plant.growth-window-min':
        case 'plant.growth-window-max':
            return <SunMoon aria-hidden className={attributeIconClassName} />;
        case 'plant.water':
            return <Droplet aria-hidden className={attributeIconClassName} />;
        case 'plant.harvest-window-min':
        case 'plant.harvest-window-max':
        case 'plant.clean-harvest':
            return <Store aria-hidden className={attributeIconClassName} />;
        case 'plant.yield-min':
        case 'plant.yield-max':
        case 'plant.yield-type':
            return (
                <ShoppingCart aria-hidden className={attributeIconClassName} />
            );
        default:
            return null;
    }
}
