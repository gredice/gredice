import { Add } from "@signalco/ui-icons";
import { Input } from "@signalco/ui-primitives/Input";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Button } from "@signalco/ui-primitives/Button";
import { submitCreateForm } from "../(actions)/entityFormActions";
import { IconButton } from "@signalco/ui-primitives/IconButton";

export function EntityTypeCreateModal() {
    return (
        <Modal
            trigger={(
                <IconButton title="Dodaj novi tip zapisa" variant="plain">
                    <Add className="size-5" />
                </IconButton>
            )}
            title={"Novi tip zapisa"}>
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