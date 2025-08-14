'use client';

import { useState } from "react";
import { Modal } from "@signalco/ui-primitives/Modal";
import { CreateTimeSlotForm } from "./CreateTimeSlotForm";

type Location = {
    id: number;
    name: string;
};

type CreateTimeSlotModalProps = {
    trigger: React.ReactElement;
    locations: Location[];
};

export function CreateTimeSlotModal({ trigger, locations }: CreateTimeSlotModalProps) {
    const [open, setOpen] = useState(false);

    return (
        <Modal
            trigger={trigger}
            title="Kreiraj novi slot"
            open={open}
            onOpenChange={setOpen}
            className="md:max-w-md"
        >
            <CreateTimeSlotForm locations={locations} />
        </Modal>
    );
}
