import {
    GameHarvestIcon,
    GameSeedlingIcon,
    GameToolsIcon,
    GameWaterIcon,
} from '@gredice/ui/GameIcons';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';

const sectionStyles = {
    watering: {
        title: 'Zalijevanje',
        icon: GameWaterIcon,
        background: 'bg-sky-100/70 dark:bg-sky-950/50',
    },
    harvest: {
        title: 'Berba',
        icon: GameHarvestIcon,
        background: 'bg-amber-100/70 dark:bg-amber-950/50',
    },
    sowing: {
        title: 'Sijanje',
        icon: GameSeedlingIcon,
        background: 'bg-emerald-100/70 dark:bg-emerald-950/50',
    },
    tasks: {
        title: 'Zadaci',
        icon: GameToolsIcon,
        background: 'bg-primary/10',
    },
};

interface ScheduleSectionHeaderProps {
    section: keyof typeof sectionStyles;
    children?: ReactNode;
}

export function ScheduleSectionHeader({
    section,
    children,
}: ScheduleSectionHeaderProps) {
    const { title, icon: Icon, background } = sectionStyles[section];

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/70 pb-3">
            <Typography
                component="h2"
                level="body1"
                semiBold
                className="flex min-w-0 items-center gap-2.5"
            >
                <span
                    aria-hidden="true"
                    className={cx(
                        'flex size-10 shrink-0 items-center justify-center rounded-xl',
                        background,
                    )}
                >
                    <Icon className="size-8" focusable="false" />
                </span>
                {title}
            </Typography>
            {children && <div className="ml-auto">{children}</div>}
        </div>
    );
}
