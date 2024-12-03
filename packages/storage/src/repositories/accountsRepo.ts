import 'server-only';
import { accounts, accountUsers, storage } from "..";
import { eq } from 'drizzle-orm';

export function getAccounts() {
    return storage.query.accounts.findMany();
}

export function getAccount(accountId: string) {
    return storage.query.accounts.findFirst({
        where: eq(accounts.id, accountId),
        with: {
            accounts: {
                with: {
                    account: true
                }
            }
        }
    });
}

export function getAccountUsers(accountId: string) {
    return storage.query.accountUsers.findMany({
        where: eq(accountUsers.accountId, accountId),
        with: {
            user: true
        }
    });
}
