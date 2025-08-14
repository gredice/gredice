'use client';

import { useState } from "react";
import { Modal } from "@signalco/ui-primitives/Modal";
import { BulkGenerateForm } from "./BulkGenerateForm";

type Location = {
    id: number;
    name: string;
};

type BulkGenerateModalProps = {
    trigger: React.ReactElement;
    locations: Location[];
};

export function BulkGenerateModal({ trigger, locations }: BulkGenerateModalProps) {
    const [open, setOpen] = useState(false);

    return (
        <Modal
            trigger={trigger}
            title="Generiraj slotove u bloku"
            open={open}
            onOpenChange={setOpen}
            className="md:max-w-2xl"
        >
            <BulkGenerateForm locations={locations} />
        </Modal>
    );
}
