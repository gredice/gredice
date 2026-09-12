import { ArchiveIcon } from '@gredice/ui/ArchiveIcon';
import { BackpackIcon } from '@gredice/ui/BackpackIcon';
import { GameRaisedBedIcon as RaisedBedIcon } from '@gredice/ui/GameIcons';
import { PlantGridIcon } from '@gredice/ui/GridIcons';
import { MoveIndicator } from '@packages/game/controls/components/MoveIndicator';
import { RainIcon } from '@packages/game/hud/components/weather/icons/RainIcon';
import { weatherDefinitions } from '@packages/game/hud/components/weather/icons/weatherDefinitions';
import { weatherIcons } from '@packages/game/hud/components/weather/WeatherIcons';
import { ArrowKey } from '@packages/game/hud/controls-tooltip/ArrowKey';
import { MouseIcon } from '@packages/game/hud/controls-tooltip/MouseIcon';
import { PinchGesture } from '@packages/game/hud/controls-tooltip/PinchGesture';
import { ScrollWheelIndicator } from '@packages/game/hud/controls-tooltip/ScrollWheelIndicator';
import { TouchIndicator } from '@packages/game/hud/controls-tooltip/TouchIndicator';
import { WireframeCube } from '@packages/game/hud/controls-tooltip/WireframeCube';
import { DragGripIndicator } from '@packages/game/hud/raisedBed/DragHandle';
import { SuncokretUsageButton } from '@packages/game/hud/SuncokretUsageButton';
import { CompanyGoogle } from '@packages/game/modals/components/CompanyGoogle';
import { SoundSlider } from '@packages/game/modals/components/SoundSlider';
import Image from 'next/image';
import type { ReactNode } from 'react';
import backpackSrc from '../../../../../garden/public/assets/hud/inventory-backpack.webp?url';
import outletSrc from '../../../../../garden/public/assets/hud/outlet-seedling-price-tag.webp?url';
import basketSrc from '../../../../../garden/public/assets/hud/shopping-basket.webp?url';
import checklistSrc from '../../../../../garden/public/assets/hud/tutorial-task-list.png?url';
import recycleSrc from '../../../../../garden/public/assets/textures/recycle.png?url';
import { gameIconComparisons } from '../../ui/gameIconComparisons';
import { gameIconUsage } from './gameIconUsage';

export type GameIconEntry = {
    name: string;
    group: string;
    description: string;
    sources: string[];
    preview: ReactNode;
};

const customGlyphs = [
    {
        name: 'BackpackIcon',
        Icon: BackpackIcon,
        description: 'Legacy outline; game surfaces use GameBackpackIcon.',
    },
    {
        name: 'ArchiveIcon',
        Icon: ArchiveIcon,
        description:
            'Available shared custom glyph; not currently imported by game surfaces.',
    },
].map(({ name, Icon, description }) => ({
    name,
    group: 'Custom monochrome',
    description,
    sources: [`packages/ui/src/${name}/${name}.tsx`],
    preview: <Icon className="size-10" />,
}));

const artwork = [
    {
        name: 'Shopping basket',
        src: basketSrc,
        source: 'apps/garden/public/assets/hud/shopping-basket.webp',
        usage: 'packages/game/src/hud/ShoppingCartHud.tsx',
        description: 'Styled reference for shopping-cart actions.',
    },
    {
        name: 'Inventory backpack',
        src: backpackSrc,
        source: 'apps/garden/public/assets/hud/inventory-backpack.webp',
        usage: 'packages/game/src/hud/InventoryHud.tsx',
        description:
            'Styled inventory HUD trigger; also used by GameBackpackIcon.',
    },
    {
        name: 'Outlet seedling price tag',
        src: outletSrc,
        source: 'apps/garden/public/assets/hud/outlet-seedling-price-tag.webp',
        usage: 'packages/game/src/hud/OutletHud.tsx',
        description: 'Styled outlet shop entry point.',
    },
    {
        name: 'Tutorial task list',
        src: checklistSrc,
        source: 'apps/garden/public/assets/hud/tutorial-task-list.png',
        usage: 'packages/game/src/hud/TutorialChecklistHud.tsx',
        description: 'Styled tutorial checklist trigger.',
    },
    {
        name: 'Sunflower',
        src: '/game-icons/sunflower-large.svg',
        source: 'https://cdn.gredice.com/sunflower-large.svg',
        usage: 'packages/game/src/hud/SunflowersHud.tsx',
        description: 'Currency, rewards and Suncokret assistant identity.',
    },
    {
        name: 'SantaCapIcon',
        src: '/game-icons/advent-hat-512x493.png',
        source: 'https://cdn.gredice.com/assets/advent-hat-512x493.png',
        usage: 'packages/game/src/icons/SantaCap.tsx',
        description: 'Seasonal Advent HUD and calendar artwork.',
    },
    {
        name: 'Advent gift box',
        src: '/game-icons/advent-gift-box-secret-766x714.png',
        source: 'https://cdn.gredice.com/assets/advent-gift-box-secret-766x714.png',
        usage: 'packages/game/src/modals/advent/AdventDescriptionScreen.tsx',
        description: 'Seasonal mystery reward artwork.',
    },
    {
        name: 'Recycle',
        src: recycleSrc,
        source: 'apps/garden/public/assets/textures/recycle.png',
        usage: 'packages/game/src/controls/PickableGroup.tsx',
        description: 'Pickable waste and sunflower reward history.',
    },
].map(({ name, src, source, usage, description }) => ({
    name,
    group: 'Styled artwork',
    description,
    sources: [source, usage],
    // Storybook mocks next/image; these sources are all served locally.
    preview: (
        <Image
            src={src}
            alt=""
            width={80}
            height={80}
            className="size-20 object-contain"
        />
    ),
}));

export const gameIconCatalog: GameIconEntry[] = [
    ...artwork,
    ...gameIconComparisons.map(
        ({ componentName, after: Icon, usage, legacyName, sources }) => ({
            name: componentName,
            group: 'Styled game illustrations',
            description: `${usage}. Replaces ${legacyName} in the game; before/after sizes are in packages/ui/Icons/GameIcons.`,
            sources,
            preview: <Icon className="size-12" />,
        }),
    ),
    ...gameIconUsage.map(({ name, Icon, lucideName, sources }) => {
        return {
            name,
            group: lucideName ? 'Lucide monochrome' : 'Brand marks',
            description: lucideName
                ? `Lucide: ${lucideName}. Export: @gredice/ui/icons/${name}.`
                : 'Facebook sign-in and connected account.',
            sources: ['packages/ui/src/icons/index.ts', ...sources],
            preview: <Icon className="size-10" />,
        };
    }),
    ...customGlyphs,
    ...[null, 'A12'].map((physicalId) => ({
        name: physicalId
            ? 'GameRaisedBedIcon · identifier'
            : 'GameRaisedBedIcon',
        group: 'Styled game illustrations',
        description: 'Styled bed with the shared physical-identifier layout.',
        sources: [
            'packages/ui/src/RaisedBedIcon/RaisedBedIcon.tsx',
            'packages/game/src/hud/RaisedBedFieldHud.tsx',
        ],
        preview: (
            <RaisedBedIcon
                physicalId={physicalId}
                className={physicalId ? undefined : 'size-10'}
            />
        ),
    })),
    ...[1, 4, 9, 16].map((totalPlants) => ({
        name: `PlantGridIcon · ${totalPlants}`,
        group: 'Custom monochrome',
        description: `Plant density: Grid${totalPlants}Icon.`,
        sources: [
            `packages/ui/src/GridIcons/Grid${totalPlants}Icon.tsx`,
            'packages/game/src/hud/raisedBed/AdvancedSowingPickerPreview.tsx',
        ],
        preview: (
            <PlantGridIcon totalPlants={totalPlants} className="size-10" />
        ),
    })),
    {
        name: 'CompanyGoogle',
        group: 'Brand marks',
        description: 'Google sign-in.',
        sources: ['packages/game/src/modals/components/CompanyGoogle.tsx'],
        preview: <CompanyGoogle className="size-10" />,
    },
    {
        name: 'MouseIcon',
        group: 'Custom monochrome',
        description: 'Desktop camera controls.',
        sources: ['packages/game/src/hud/controls-tooltip/MouseIcon.tsx'],
        preview: <MouseIcon />,
    },
    ...(
        [
            'ArrowUp',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
        ] satisfies Parameters<typeof ArrowKey>[0]['keyName'][]
    ).map((keyName) => ({
        name: `ArrowKey · ${keyName}`,
        group: 'Custom monochrome',
        description: 'Keyboard movement hint.',
        sources: ['packages/game/src/hud/controls-tooltip/ArrowKey.tsx'],
        preview: <ArrowKey keyName={keyName} activeKey={keyName} />,
    })),
    {
        name: 'ScrollWheelIndicator',
        group: 'Custom monochrome',
        description: 'Scroll-to-zoom arrow and mouse.',
        sources: [
            'packages/game/src/hud/controls-tooltip/ScrollWheelIndicator.tsx',
        ],
        preview: <ScrollWheelIndicator isZoomingIn progress={0.75} />,
    },
    {
        name: 'PinchGesture',
        group: 'Custom monochrome',
        description: 'Touch zoom hint.',
        sources: ['packages/game/src/hud/controls-tooltip/PinchGesture.tsx'],
        preview: <PinchGesture spread={0.75} />,
    },
    {
        name: 'TouchIndicator',
        group: 'Custom monochrome',
        description: 'Touch movement hint.',
        sources: ['packages/game/src/hud/controls-tooltip/TouchIndicator.tsx'],
        preview: <TouchIndicator touchX={0} />,
    },
    {
        name: 'WireframeCube',
        group: 'Custom monochrome',
        description: 'Camera-control visualization.',
        sources: ['packages/game/src/hud/controls-tooltip/WireframeCube.tsx'],
        preview: <WireframeCube size={64} />,
    },
    {
        name: 'DragGripIndicator',
        group: 'Custom monochrome',
        description: 'Six-dot grip on draggable planting cells.',
        sources: ['packages/game/src/hud/raisedBed/DragHandle.tsx'],
        preview: (
            <div className="relative size-10">
                <DragGripIndicator />
            </div>
        ),
    },
    {
        name: 'MoveIndicator',
        group: 'Custom indicators',
        description: 'Directional movement arrows in the game.',
        sources: ['packages/game/src/controls/components/MoveIndicator.tsx'],
        preview: (
            <div inert>
                <MoveIndicator />
            </div>
        ),
    },
    {
        name: 'Suncokret usage rings',
        group: 'Custom indicators',
        description: 'Daily and weekly remaining usage, shown at 75% and 40%.',
        sources: ['packages/game/src/hud/SuncokretUsageButton.tsx'],
        preview: (
            <SuncokretUsageButton
                day={{ usedPercent: 25, remainingPercent: 75 }}
                week={{ usedPercent: 60, remainingPercent: 40 }}
            />
        ),
    },
    ...[0, 25, 50, 100].map((value) => ({
        name: `SoundSlider speaker · ${value}%`,
        group: 'Custom monochrome',
        description:
            'Custom inline speaker glyph shown in its owning control, including mute and volume waves.',
        sources: ['packages/game/src/modals/components/SoundSlider.tsx'],
        preview: (
            <div inert className="w-full">
                <SoundSlider
                    label="Sound"
                    value={value}
                    muted={value === 0}
                    onChange={() => {}}
                    onMuteToggle={() => {}}
                />
            </div>
        ),
    })),
    ...[0, 50, 100].map((chance) => ({
        name: `RainIcon · ${chance}%`,
        group: 'Weather',
        description: 'Precipitation indicator with adjustable fill.',
        sources: [
            'packages/game/src/hud/components/weather/icons/RainIcon.tsx',
        ],
        preview: <RainIcon chance={chance} />,
    })),
    ...Object.entries(weatherDefinitions).flatMap(([code, definition]) =>
        Object.entries(weatherIcons[Number(code)]).map(([period, Icon]) => ({
            name: `${definition.name} · ${period}`,
            group: 'Weather',
            description: `${definition.label}. Condition ${code}, ${period}; composed 3D artwork.`,
            sources: [
                'packages/game/src/hud/components/weather/WeatherIcons.tsx',
                'packages/game/src/hud/components/weather/icons/weatherDefinitions.ts',
                'packages/game/src/hud/components/weather/icons/weatherComposition.ts',
                'packages/game/src/hud/WeatherHud.tsx',
            ],
            preview: <Icon className="size-16" />,
        })),
    ),
    ...[
        {
            name: 'Achievement trophy',
            glyph: '🏆',
            source: 'packages/game/src/shared-ui/achievements/AchievementsOverview.tsx',
        },
        {
            name: 'Locked achievement',
            glyph: '?',
            source: 'packages/game/src/shared-ui/achievements/AchievementsOverview.tsx',
        },
        {
            name: 'Gift fallback',
            glyph: '🎁',
            source: 'packages/game/src/modals/advent/AdventAwardScreen.tsx',
        },
        {
            name: 'Opened Advent reward',
            glyph: '✅',
            source: 'packages/game/src/modals/advent/AdventAlreadyOpenedScreen.tsx',
        },
        {
            name: 'Missed Advent reward',
            glyph: '😢',
            source: 'packages/game/src/modals/advent/AdventMissedDayScreen.tsx',
        },
    ].map(({ name, glyph, source }) => ({
        name,
        group: 'Text and emoji',
        description:
            'Existing symbol; appearance depends on the platform font.',
        sources: [source],
        preview: <span className="text-4xl">{glyph}</span>,
    })),
];
