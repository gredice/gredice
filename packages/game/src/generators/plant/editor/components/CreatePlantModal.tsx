'use client';

import { Add } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import type { CreatePlantDialogProps } from '../@types/plant-generator';

export function CreatePlantModal({
    existingNames,
    onCreatePlant,
}: CreatePlantDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [plantName, setPlantName] = useState('');
    const [error, setError] = useState('');

    /**
     * Validate plant name
     */
    const validateName = (name: string): string => {
        if (!name.trim()) return 'Plant name is required';
        if (name.length < 2) return 'Plant name must be at least 2 characters';
        if (name.length > 50)
            return 'Plant name must be less than 50 characters';
        if (existingNames.includes(name.toLowerCase()))
            return 'A plant with this name already exists';
        if (!/^[a-zA-Z0-9\s-_]+$/.test(name))
            return 'Plant name can only contain letters, numbers, spaces, hyphens, and underscores';
        return '';
    };

    /**
     * Handle form submission
     */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const validationError = validateName(plantName);
        if (validationError) {
            setError(validationError);
            return;
        }

        onCreatePlant(plantName.trim());
        setPlantName('');
        setError('');
        setIsOpen(false);
    };

    /**
     * Handle name input change
     */
    const handleNameChange = (value: string) => {
        setPlantName(value);
        if (error) {
            const validationError = validateName(value);
            setError(validationError);
        }
    };

    /**
     * Reset form when dialog opens/closes
     */
    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            setPlantName('');
            setError('');
        }
    };

    return (
        <Modal
            title="Nova biljka"
            open={isOpen}
            onOpenChange={handleOpenChange}
            trigger={
                <Button variant="outlined">
                    <Add className="size-4 shrink-0" />
                    Kreiraj biljku
                </Button>
            }
        >
            <Typography>Kreiraj prilagođenu biljku</Typography>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    id="plant-name"
                    label="Naziv biljke"
                    value={plantName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Enter plant name..."
                    className={error ? 'border-red-500' : ''}
                    helperText={error || ''}
                />
                <div className="text-sm text-muted-foreground">
                    <p>
                        Ova opcija će kreirati novu prilagođenu biljku na osnovu
                        vaših trenutnih postavki:
                    </p>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                        <li>Trenutna L-sistem pravila i aksiom</li>
                        <li>
                            Sve vrednosti parametara (stabljika, list, cvet,
                            plod)
                        </li>
                        <li>Boje i vizuelne osobine</li>
                    </ul>
                </div>
                <Row justifyContent="space-between">
                    <Button onClick={() => handleOpenChange(false)}>
                        Otkaži
                    </Button>
                    <Button
                        type="submit"
                        disabled={!!error || !plantName.trim()}
                    >
                        Kreiraj biljku
                    </Button>
                </Row>
            </form>
        </Modal>
    );
}
