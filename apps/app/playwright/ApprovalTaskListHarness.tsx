import { useState } from 'react';
import { ApprovalTaskList } from '../app/admin/approvals/ApprovalTaskList';
import type { AdminApprovalTask } from '../src/approvalTasks';

const tasks: AdminApprovalTask[] = [
    {
        id: 'approval:bean',
        kind: 'plantStatusRequest',
        requestId: 'bean',
        title: 'Promjena stanja biljke',
        description: 'Polje 15: Grah Borlotto lingua di fuoco nano',
        plantImageUrl: 'https://images.example.test/bean.png',
        raisedBedId: 301,
        raisedBedPhysicalId: '2',
        currentStatus: 'firstFlowers',
        requestedStatus: 'firstFruitSet',
        requestedBy: 'AI analiza gredice',
        note: 'Na grahu su vidljive formirane mahune.',
        receivedAt: new Date('2026-09-11T21:35:00Z'),
    },
    {
        id: 'approval:tomato',
        kind: 'plantStatusRequest',
        requestId: 'tomato',
        title: 'Promjena stanja biljke',
        description: 'Polje 18: Rajčica saint pierre',
        currentStatus: 'sprouted',
        requestedStatus: 'firstFlowers',
        requestedBy: 'AI analiza gredice',
        receivedAt: new Date('2026-09-08T19:11:00Z'),
    },
    {
        id: 'operation:water',
        kind: 'scheduleOperationVerification',
        operationId: 42,
        expectedEntityId: 5,
        expectedTaskVersionEventId: 10,
        operationDefinition: {
            information: { label: 'Zalijevanje gredice' },
            attributes: { category: { information: { name: 'watering' } } },
            image: null,
        },
        title: 'Verifikacija radnje',
        description: 'Zalijevanje gredice',
        completedBy: 'Vrtlar',
        receivedAt: new Date('2026-09-08T19:00:00Z'),
    },
    {
        id: 'planting:carrot',
        kind: 'schedulePlantingVerification',
        expectedPlantCycleEventId: 20,
        expectedPlantCycleVersionEventId: 25,
        expectedPlantSortId: 50,
        raisedBedId: 118,
        positionIndex: 8,
        title: 'Verifikacija sijanja',
        description: 'Polje 9: Mrkva chantenay',
        receivedAt: new Date('2026-09-04T21:13:00Z'),
    },
];

export function ApprovalTaskListHarness({
    single = false,
}: {
    single?: boolean;
}) {
    const [version, setVersion] = useState(0);
    const visibleTasks = single ? tasks.slice(2, 3) : tasks;
    return (
        <div className="bg-background p-4 text-foreground">
            <ApprovalTaskList
                items={visibleTasks.map((task) => {
                    const versionedTask =
                        task.kind === 'scheduleOperationVerification'
                            ? {
                                  ...task,
                                  expectedTaskVersionEventId:
                                      task.expectedTaskVersionEventId + version,
                              }
                            : task;
                    async function action(decision: string) {
                        const response = await fetch('/approval-test-action', {
                            method: 'POST',
                            body: JSON.stringify({ id: task.id, decision }),
                        });
                        if (!response.ok) throw new Error('Request failed');
                        return response.json();
                    }
                    return {
                        task: versionedTask,
                        approveAction: () => action('approve'),
                        rejectAction:
                            task.kind === 'plantStatusRequest'
                                ? () => action('reject')
                                : undefined,
                    };
                })}
            />
            <button
                type="button"
                onClick={() => setVersion((current) => current + 1)}
            >
                Nova verzija radnje
            </button>
        </div>
    );
}
