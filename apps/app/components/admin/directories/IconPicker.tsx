'use client';

import { Input } from '@signalco/ui-primitives/Input';
import { Popper } from '@signalco/ui-primitives/Popper';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMemo, useState } from 'react';
import { availableIcons, EntityTypeIcon } from './EntityTypeIcon';

interface IconPickerProps {
    name: string;
    value: string;
    onValueChange: (value: string) => void;
}

export function IconPicker({ name, value, onValueChange }: IconPickerProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filteredIcons = useMemo(() => {
        const sorted = [...availableIcons].sort((a, b) => a.localeCompare(b));
        if (!search) return sorted;
        const lower = search.toLowerCase();
        return sorted.filter((icon) => icon.toLowerCase().includes(lower));
    }, [search]);

    const handleSelect = (iconName: string) => {
        onValueChange(iconName);
        setOpen(false);
        setSearch('');
    };

    const handleClear = () => {
        onValueChange('');
        setOpen(false);
        setSearch('');
    };

    return (
        <div>
            <input type="hidden" name={name} value={value || 'none'} />
            <Typography level="body2" className="mb-1 font-medium">
                Ikona
            </Typography>
            <Popper
                open={open}
                onOpenChange={(isOpen) => {
                    setOpen(isOpen);
                    if (!isOpen) setSearch('');
                }}
                trigger={
                    <button
                        type="button"
                        className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => setOpen((prev) => !prev)}
                    >
                        <EntityTypeIcon
                            icon={value || null}
                            className="size-4 shrink-0"
                        />
                        <span>{value || 'Zadano (File)'}</span>
                    </button>
                }
                className="p-3 w-72"
            >
                <div className="flex flex-col gap-2">
                    <Input
                        placeholder="Pretraži ikone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                    <button
                        type="button"
                        onClick={handleClear}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${!value ? 'bg-accent font-medium' : 'hover:bg-accent'}`}
                    >
                        <EntityTypeIcon
                            icon={null}
                            className="size-4 shrink-0"
                        />
                        <span>Zadano (File)</span>
                    </button>
                    <div className="grid grid-cols-6 gap-1 max-h-60 overflow-y-auto">
                        {filteredIcons.map((iconName) => (
                            <button
                                key={iconName}
                                type="button"
                                title={iconName}
                                onClick={() => handleSelect(iconName)}
                                className={`flex items-center justify-center rounded-md p-2 transition-colors ${value === iconName ? 'bg-accent ring-1 ring-ring' : 'hover:bg-accent'}`}
                            >
                                <EntityTypeIcon
                                    icon={iconName}
                                    className="size-5"
                                />
                            </button>
                        ))}
                        {filteredIcons.length === 0 && (
                            <Typography
                                level="body2"
                                className="col-span-6 text-center py-4 text-muted-foreground"
                            >
                                Nema rezultata
                            </Typography>
                        )}
                    </div>
                    <Typography level="body3" className="text-muted-foreground">
                        Ikona se prikazuje u izborniku
                    </Typography>
                </div>
            </Popper>
        </div>
    );
}
