import { BookA, FileText } from "lucide-react";
import { type getEntityTypes } from "@gredice/storage";
import Link from "next/link";
import { ListTreeItem } from "@signalco/ui-primitives/ListTreeItem";
import { KnownPages } from "../../src/KnownPages";
import { Add } from "@signalco/ui-icons";
import { Modal } from "@signalco/ui-primitives/Modal";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Input } from "@signalco/ui-primitives/Input";
import { Button } from "@signalco/ui-primitives/Button";
import { createEntityType } from "../(actions)/entityActions";

export type EntityTypesListProps = {
    entityTypes: Awaited<ReturnType<typeof getEntityTypes>>;
};

async function EntityTypeListeItem({ entityType }: { entityType: Awaited<ReturnType<typeof getEntityTypes>>[0] }) {
    return (
        <Link href={KnownPages.DirectoryEntityType(entityType.name)} passHref legacyBehavior>
            <ListTreeItem
                label={entityType.label}
                startDecorator={<FileText className="size-5" />}>
                <Link href={KnownPages.DirectoryEntityTypeAttributeDefinitions(entityType.name)} passHref legacyBehavior>
                    <ListTreeItem label="Atributi" startDecorator={(<BookA className="size-5" />)} />
                </Link>
            </ListTreeItem>
        </Link>
    );
}

export function EntityTypesList({ entityTypes }: EntityTypesListProps) {
    async function submitForm(formData: FormData) {
        'use server';

        const name = formData.get('name') as string;
        const label = formData.get('label') as string;

        await createEntityType(name, label);
    }

    return (
        <>
            {entityTypes.map(entityType => (
                <EntityTypeListeItem
                    key={entityType.id}
                    entityType={entityType} />
            ))}
            <Modal
                trigger={(
                    <ListItem
                        label="Dodaj novi tip zapisa"
                        startDecorator={<Add className="size-5" />}
                    />
                )}>
                <Stack spacing={2}>
                    <Stack spacing={1}>
                        <Typography level="h5">
                            Novi tip zapisa
                        </Typography>
                        <Typography level="body2">
                            Unesite podatke za novi tip zapisa.
                        </Typography>
                    </Stack>
                    <form action={submitForm}>
                        <Stack spacing={4}>
                            <Stack spacing={1}>
                                <Input name="name" label="Naziv" />
                                <Input name="label" label="Labela" />
                            </Stack>
                            <Button variant="solid" type="submit">Spremi</Button>
                        </Stack>
                    </form>
                </Stack>
            </Modal>
        </>
    );
}
