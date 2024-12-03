import { Add } from "@signalco/ui-icons";
import { Input } from "@signalco/ui-primitives/Input";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Button } from "@signalco/ui-primitives/Button";
import { submitCreateForm } from "../(actions)/entityFormActions";

export function EntityTypeCreateModal() {
    return (
        <Modal
            trigger={(
                <ListItem
                    label="Dodaj novi tip zapisa"
                    startDecorator={<Add className="size-5" />}
                    className="ml-8"
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
                <form action={submitCreateForm}>
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
    );
}