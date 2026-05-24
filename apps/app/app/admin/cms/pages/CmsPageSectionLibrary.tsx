'use client';

import type {
    CmsPageSectionComponent,
    CmsPageSectionPreset,
} from '@gredice/storage/cmsPageSections';
import { Button } from '@gredice/ui/Button';
import { Card } from '@gredice/ui/Card';
import { Input } from '@gredice/ui/Input';
import { Add, Search } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';

type CmsPageSectionLibraryProps = {
    query: string;
    components: CmsPageSectionComponent[];
    presets: CmsPageSectionPreset[];
    onQueryChange: (query: string) => void;
    onInsertComponent: (component: string) => void;
    onInsertPreset: (preset: CmsPageSectionPreset) => void;
};

function matchesQuery(
    query: string,
    item: Pick<CmsPageSectionPreset, 'label' | 'description' | 'category'>,
) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
        return true;
    }

    return [item.label, item.description, item.category].some((value) =>
        value.toLowerCase().includes(normalized),
    );
}

export function CmsPageSectionLibrary({
    query,
    components,
    presets,
    onQueryChange,
    onInsertComponent,
    onInsertPreset,
}: CmsPageSectionLibraryProps) {
    const visiblePresets = presets.filter((preset) =>
        matchesQuery(query, preset),
    );
    const visibleComponents = components.filter((component) =>
        matchesQuery(query, component),
    );
    const groupedPresets = visiblePresets.reduce<
        Record<string, CmsPageSectionPreset[]>
    >((groups, preset) => {
        if (!groups[preset.category]) {
            groups[preset.category] = [];
        }
        groups[preset.category].push(preset);
        return groups;
    }, {});

    return (
        <Stack spacing={4}>
            <Input
                fullWidth
                label="Biblioteka"
                placeholder="Pretraži sekcije"
                startDecorator={<Search className="ml-3 size-4 shrink-0" />}
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
            />
            <Stack spacing={3}>
                {Object.entries(groupedPresets).map(([category, items]) => (
                    <Stack spacing={2} key={category}>
                        <Typography level="body3" secondary>
                            {category}
                        </Typography>
                        {items.map((preset) => (
                            <Card className="p-3" key={preset.id}>
                                <Stack spacing={2}>
                                    <Typography level="body2" semiBold>
                                        {preset.label}
                                    </Typography>
                                    <Typography
                                        level="body3"
                                        className="line-clamp-2"
                                        secondary
                                    >
                                        {preset.description}
                                    </Typography>
                                    <Button
                                        type="button"
                                        variant="outlined"
                                        size="sm"
                                        startDecorator={
                                            <Add className="size-4" />
                                        }
                                        onClick={() => onInsertPreset(preset)}
                                    >
                                        Dodaj
                                    </Button>
                                </Stack>
                            </Card>
                        ))}
                    </Stack>
                ))}
            </Stack>
            <Stack spacing={2}>
                <Typography level="body3" secondary>
                    Prazne komponente
                </Typography>
                {visibleComponents.map((component) => (
                    <Button
                        key={component.component}
                        type="button"
                        variant="plain"
                        className="justify-start"
                        startDecorator={<Add className="size-4" />}
                        onClick={() => onInsertComponent(component.component)}
                    >
                        {component.label}
                    </Button>
                ))}
            </Stack>
        </Stack>
    );
}
