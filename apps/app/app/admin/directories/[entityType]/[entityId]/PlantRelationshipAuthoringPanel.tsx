import {
    getPlantRelationshipAuthoringSummary,
    type PlantRelationshipAuthoringEntry,
    type PlantRelationshipConflict,
} from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Chip } from '@gredice/ui/Chip';
import { Warning } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { KnownPages } from '../../../../../src/KnownPages';

function directionLabel(entry: PlantRelationshipAuthoringEntry) {
    if (entry.directions.includes('incoming')) {
        return 'recipročno';
    }
    return 'ovdje';
}

function RelationshipChips({
    entries,
}: {
    entries: PlantRelationshipAuthoringEntry[];
}) {
    if (entries.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-2">
            {entries.map((entry) => (
                <Chip
                    key={entry.id}
                    href={KnownPages.DirectoryEntity('plant', entry.id)}
                    size="sm"
                    variant="outlined"
                    color={
                        entry.relationship === 'companion'
                            ? 'success'
                            : 'warning'
                    }
                    title={`${entry.name} (${directionLabel(entry)})`}
                >
                    {entry.name}
                </Chip>
            ))}
        </div>
    );
}

function IncomingRelationshipGroup({
    entries,
    title,
}: {
    entries: PlantRelationshipAuthoringEntry[];
    title: string;
}) {
    const incomingEntries = entries.filter((entry) =>
        entry.directions.includes('incoming'),
    );
    if (incomingEntries.length === 0) {
        return null;
    }

    return (
        <Stack spacing={2}>
            <Typography level="body2" semiBold>
                {title}
            </Typography>
            <RelationshipChips entries={incomingEntries} />
        </Stack>
    );
}

function ConflictAlert({
    conflicts,
}: {
    conflicts: PlantRelationshipConflict[];
}) {
    if (conflicts.length === 0) {
        return null;
    }

    return (
        <Alert color="warning" startDecorator={<Warning className="size-4" />}>
            <Stack spacing={2}>
                <Typography level="body2" semiBold>
                    Provjeri odnos koji je označen kao dobar i loš susjed.
                </Typography>
                <Row spacing={2} className="flex-wrap">
                    {conflicts.map((conflict) => (
                        <Chip
                            key={conflict.plant.id}
                            href={KnownPages.DirectoryEntity(
                                'plant',
                                conflict.plant.id,
                            )}
                            size="sm"
                            color="warning"
                            variant="outlined"
                        >
                            {conflict.plant.name}
                        </Chip>
                    ))}
                </Row>
            </Stack>
        </Alert>
    );
}

export async function PlantRelationshipAuthoringPanel({
    entityId,
}: {
    entityId: number;
}) {
    const summary = await getPlantRelationshipAuthoringSummary(entityId);
    const hasIncoming =
        summary.companions.some((entry) =>
            entry.directions.includes('incoming'),
        ) ||
        summary.antagonists.some((entry) =>
            entry.directions.includes('incoming'),
        );
    if (!hasIncoming && summary.conflicts.length === 0) {
        return null;
    }

    return (
        <Stack spacing={3}>
            <ConflictAlert conflicts={summary.conflicts} />
            {hasIncoming ? (
                <Stack
                    spacing={3}
                    className="rounded-lg border border-border/70 p-4"
                >
                    <Typography level="body1" semiBold>
                        Veze unesene na drugim biljkama
                    </Typography>
                    <IncomingRelationshipGroup
                        title="Dobri susjedi"
                        entries={summary.companions}
                    />
                    <IncomingRelationshipGroup
                        title="Loši susjedi"
                        entries={summary.antagonists}
                    />
                </Stack>
            ) : null}
        </Stack>
    );
}
