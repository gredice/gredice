import { useCurrentAccount } from '../src/hooks/useCurrentAccount';

export function CurrentAccountQueryProbe({ enabled }: { enabled: boolean }) {
    const account = useCurrentAccount(enabled);
    return <output data-testid="account-query">{account.fetchStatus}</output>;
}
