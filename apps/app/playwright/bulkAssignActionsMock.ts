function recordAssignment(kind: string, args: unknown[]) {
    const calls = JSON.parse(
        document.documentElement.dataset.bulkAssignCalls ?? '[]',
    );
    calls.push({ kind, args });
    document.documentElement.dataset.bulkAssignCalls = JSON.stringify(calls);
}

export async function assignOperationUserAction(...args: unknown[]) {
    recordAssignment('operation', args);
}

export async function assignRaisedBedFieldUserAction(...args: unknown[]) {
    recordAssignment('field', args);
}
