import { getLatestEntityRevisions } from '@gredice/storage';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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

function isDeleteAction(action: string): boolean {
    return (action.split('.').at(-1) ?? action) === 'deleted';
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
        <Stack spacing={8}>
            <AdminPageHeader>
                <AdminPageTitle title="Aktivnosti" />
            </AdminPageHeader>

            <Stack spacing={4}>
                {revisions.length === 0 ? (
                    <Typography level="body2">Nema aktivnosti.</Typography>
                ) : (
                    revisions.map((revision) => {
                        const isDeleted = isDeleteAction(revision.action);

                        return (
                            <div
                                key={revision.id}
                                className="rounded-md border p-3"
                            >
                                <Row
                                    className="items-center justify-between"
                                    spacing={4}
                                >
                                    <Stack spacing={1}>
                                        <Typography level="body2" semiBold>
                                            {formatAction(revision.action)}
                                        </Typography>
                                        <Typography
                                            level="label"
                                            className="text-muted-foreground"
                                        >
                                            {formatDateTime(revision.createdAt)}{' '}
                                            •{' '}
                                            {revision.actorName ??
                                                'Nepoznat korisnik'}
                                        </Typography>
                                    </Stack>
                                    {isDeleted ? (
                                        <Typography
                                            level="label"
                                            className="text-muted-foreground"
                                        >
                                            Obrisani zapis #{revision.entityId}
                                        </Typography>
                                    ) : (
                                        <Link
                                            href={KnownPages.DirectoryEntity(
                                                revision.entityTypeName,
                                                revision.entityId,
                                            )}
                                            className="text-sm underline"
                                        >
                                            Otvori zapis #{revision.entityId}
                                        </Link>
                                    )}
                                </Row>
                            </div>
                        );
                    })
                )}
            </Stack>
        </Stack>
    );
}
