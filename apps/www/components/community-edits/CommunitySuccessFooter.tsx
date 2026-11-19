import { Button } from '@gredice/ui/Button';
import { Row } from '@gredice/ui/Row';
import { KnownPages } from '../../src/KnownPages';

/** Footer actions of a community dialog after a suggestion was sent. */
export function CommunitySuccessFooter({ onClose }: { onClose: () => void }) {
    return (
        <Row spacing={2} className="ml-auto shrink-0">
            <Button onClick={onClose} type="button" variant="plain">
                Zatvori
            </Button>
            <Button href={KnownPages.MySuggestions} variant="outlined">
                Moji prijedlozi
            </Button>
        </Row>
    );
}
