import { IconButton } from '@gredice/ui/IconButton';
import { Save } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { PlantDefinition } from '../../lib/plant-definitions';

interface ExportDialogProps {
    definition: PlantDefinition;
}

export function ExportDialog({ definition }: ExportDialogProps) {
    return (
        <Modal
            title="Export Plant Definition"
            trigger={
                <IconButton title="Spremi">
                    <Save className="size-4 shrink-0" />
                </IconButton>
            }
        >
            <Stack spacing={4}>
                <Typography>Export Plant Definition</Typography>
                <Typography level="body2">
                    Copy this JSON and paste it into the{' '}
                    <code>plant-definitions.ts</code> file to save your custom
                    plant.
                </Typography>
                <textarea
                    readOnly
                    value={JSON.stringify(definition, null, 2)}
                    rows={20}
                    className="font-mono text-xs w-full"
                />
            </Stack>
        </Modal>
    );
}
