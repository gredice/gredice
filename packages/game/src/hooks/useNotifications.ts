import { client } from '@gredice/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useNotifications(userId?: string, read?: boolean) {
  return useQuery({
    queryKey: ['notifications', userId, read],
    queryFn: async () => {
      if (!userId) return [];
      const response = await client().api.notifications.$get({
        query: {
          userId,
          read: read ? "true" : undefined,
        }
      });
      return await response.json();
    },
    enabled: !!userId,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, readWhere }: { id: number; readWhere: string }) => {
      const res = await client().api.notifications.$post({
        body: {
          id,
          readWhere,
        }
      });
      if (!res.ok)
        throw new Error('Failed to mark notification as read');
      return res.json();
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['notifications', id] });
    },
  });
}
