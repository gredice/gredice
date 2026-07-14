import { Input } from '@gredice/ui/Input';
import { Modal } from '@gredice/ui/Modal';

export function MobileModalForm() {
    return (
        <Modal mobileOverride open title="Uredi podatke">
            <Input fullWidth label="Naziv" />
        </Modal>
    );
}
