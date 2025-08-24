import { auth } from '../../../../lib/auth/auth';
import { EmailSendForm } from './EmailSendForm';

export async function EmailsList() {
    const { user } = await auth(['admin']);
    const userName = user.userName;

    return (
        <div>
            <div className="max-w-fit">
                <EmailSendForm from={userName} />
            </div>
        </div>
    );
}
