import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { currentAccountKeys } from './useCurrentAccount';

export const tutorialChecklistKeys = [
    'accounts',
    'current',
    'tutorial-checklist',
];

async function fetchTutorialChecklist() {
    const response =
        await clientAuthenticated().api.accounts.current[
            'tutorial-checklist'
        ].$get();
    if (!response.ok) {
        throw new Error(
            `Failed to fetch tutorial checklist: ${response.status} ${response.statusText}`,
        );
    }
    return response.json();
}

export type TutorialChecklistState = Awaited<
    ReturnType<typeof fetchTutorialChecklist>
>;
export type TutorialChecklistGroup = TutorialChecklistState['groups'][number];
export type TutorialChecklistTask = TutorialChecklistGroup['tasks'][number];

export function useTutorialChecklist() {
    return useQuery({
        queryKey: tutorialChecklistKeys,
        queryFn: fetchTutorialChecklist,
        staleTime: 1000 * 60,
    });
}

export function useClaimTutorialChecklistTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (taskKey: string) => {
            const response = await clientAuthenticated().api.accounts.current[
                'tutorial-checklist'
            ][':taskKey'].claim.$post({
                param: { taskKey },
            });
            if (!response.ok) {
                const reason = await response.text();
                throw new Error(reason || 'Failed to claim checklist task');
            }
            return response.json();
        },
        onSuccess: (state) => {
            queryClient.setQueryData(tutorialChecklistKeys, state);
            queryClient.invalidateQueries({ queryKey: tutorialChecklistKeys });
            queryClient.invalidateQueries({ queryKey: currentAccountKeys });
        },
    });
}
