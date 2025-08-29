'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useRef, useState } from 'react';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import {
    completeOperation,
    completeOperationWithImages,
} from '../../(actions)/operationActions';

type CompleteOperationModalProps = {
    operationId: number;
    label: string;
    userId: string;
    conditions?: EntityStandardized['conditions'];
};

export function CompleteOperationModal({
    operationId,
    label,
    userId,
    conditions,
}: CompleteOperationModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const attachImages = conditions?.completionAttachImages;
    const attachRequired = conditions?.completionAttachImagesRequired;

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            setFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleConfirm = async () => {
        if (attachImages && files.length > 0) {
            const formData = new FormData();
            formData.append('operationId', operationId.toString());
            formData.append('completedBy', userId);
            for (const file of files) {
                formData.append('images', file);
            }
            await completeOperationWithImages(formData);
        } else {
            await completeOperation(operationId, userId);
        }
        handleOpenChange(false);
    };

    return (
        <Modal
            title="Potvrda završetka operacije"
            open={isOpen}
            onOpenChange={handleOpenChange}
            trigger={<Checkbox />}
        >
            <Stack spacing={2}>
                <Typography>
                    Jeste li sigurni da želite označiti operaciju kao završenu:{' '}
                    <strong>{label}</strong>?
                </Typography>
                {attachImages && (
                    <Stack spacing={1}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            multiple
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <Button
                            variant="outlined"
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {files.length > 0
                                ? 'Dodaj još slika'
                                : 'Dodaj slike'}
                        </Button>
                        {files.length > 0 && (
                            <Typography level="body2">
                                Odabrano {files.length}{' '}
                                {files.length === 1 ? 'slika' : 'slike'}
                            </Typography>
                        )}
                    </Stack>
                )}
                <Row spacing={1} justifyContent="end">
                    <Button
                        variant="outlined"
                        onClick={() => handleOpenChange(false)}
                    >
                        Odustani
                    </Button>
                    <Button
                        variant="solid"
                        onClick={handleConfirm}
                        disabled={attachRequired && files.length === 0}
                    >
                        Potvrdi
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}
