import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useNotifications(userId: string, read?: boolean) {
  return useQuery({
    queryKey: ['notifications', userId, read],
    queryFn: async () => {
      const params = new URLSearchParams({ userId });
      if (read !== undefined) params.append('read', String(read));
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json();
    },
    enabled: !!userId,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, readWhere }: { id: number; readWhere: string }) => {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, readWhere }),
      });
      if (!res.ok) throw new Error('Failed to mark notification as read');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
