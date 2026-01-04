'use server';

import { getAdventCalendarTopUsers } from '@gredice/storage';
import { auth } from '../../../lib/auth/auth';

export async function getAdventTopUsers(year: number) {
    await auth(['admin']);
    return await getAdventCalendarTopUsers(year);
}
