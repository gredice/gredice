import { getLatestEntityRevisions } from '@gredice/storage';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import {
    AdminPageHeader,
    AdminPageTitle,
} from '../../../../components/admin/navigation';
import { KnownPages } from '../../../../src/KnownPages';

const actionLabels: Record<string, string> = {
    created: 'Kreirano',
    updated: 'Ažurirano',
    deleted: 'Obrisano',
    restored: 'Vraćeno',
    imported: 'Uvezeno',
};

function formatAction(action: string): string {
    const normalizedAction = action.split('.').at(-1) ?? action;
    return (
        actionLabels[normalizedAction] ?? normalizedAction.replace(/[_-]/g, ' ')
    );
}

function formatDateTime(value: Date): string {
    return new Intl.DateTimeFormat('hr-HR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(value);
}

export default async function DirectoryActivityPage() {
    const revisions = await getLatestEntityRevisions(200);

    return (
        <Stack spacing={4}>
            <AdminPageHeader>
                <AdminPageTitle title="Aktivnosti" />
            </AdminPageHeader>

            <Stack spacing={2}>
                {revisions.length === 0 ? (
                    <Typography level="body2">Nema aktivnosti.</Typography>
                ) : (
                    revisions.map((revision) => (
                        <div
                            key={revision.id}
                            className="rounded-md border p-3"
                        >
                            <Row
                                className="items-center justify-between"
                                spacing={2}
                            >
                                <Stack spacing={0.5}>
                                    <Typography level="body2" semiBold>
                                        {formatAction(revision.action)}
                                    </Typography>
                                    <Typography
                                        level="label"
                                        className="text-muted-foreground"
                                    >
                                        {formatDateTime(revision.createdAt)} •{' '}
                                        {revision.actorName ??
                                            'Nepoznat korisnik'}
                                    </Typography>
                                </Stack>
                                <Link
                                    href={KnownPages.DirectoryEntity(
                                        revision.entityTypeName,
                                        revision.entityId,
                                    )}
                                    className="text-sm underline"
                                >
                                    Otvori zapis #{revision.entityId}
                                </Link>
                            </Row>
                        </div>
                    ))
                )}
            </Stack>
        </Stack>
    );
}
