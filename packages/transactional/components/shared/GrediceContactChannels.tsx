import { Link } from '../Link';
import { Paragraph } from '../Paragraph';

export function GrediceContactChannels() {
    return (
        <Paragraph>
            Ako imaš pitanja ili trebaš pomoć, javi nam se putem jednog od
            kanala:
            <br />
            {'📧 '}
            <Link href="mailto:info@gredice.com">info@gredice.com</Link>
            <br />
            {'💬 '}
            <Link href="https://gredice.link/wa">WhatsApp</Link>
            <br />
            {'📷 '}
            <Link href="https://gredice.link/ig">Instagram</Link>
            {' | '}
            <Link href="https://gredice.link/fb">Facebook</Link>
        </Paragraph>
    );
}
