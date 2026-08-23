import { withAuth } from '../../../../lib/auth/auth';
import { farmOperationCompletionSyncModeFlag } from '../../../flags';

export async function GET() {
    return await withAuth(
        ['farmer', 'admin'],
        async ({ accountId, sessionIncarnation, user }) => {
            const operationCompletionSyncMode =
                await farmOperationCompletionSyncModeFlag();

            return Response.json({
                accountId,
                id: user.id,
                userName: user.userName,
                role: user.role,
                accounts: user.accountIds.map((accountId) => ({ accountId })),
                operationCompletionSyncMode,
                sessionIncarnation,
            });
        },
    );
}
