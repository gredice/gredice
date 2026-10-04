import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { InlineLoginDialog } from '../components/auth/InlineLoginDialog';

export function InlineLoginDialogHarness({
    count = 1,
    initiallyOpen = true,
}: {
    count?: number;
    initiallyOpen?: boolean;
}) {
    const [openIndex, setOpenIndex] = useState<number | null>(
        initiallyOpen ? 0 : null,
    );
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        retry: false,
                    },
                },
            }),
    );

    return (
        <QueryClientProvider client={queryClient}>
            {Array.from({ length: count }, (_, id) => id).map((index) => (
                <div key={`login-${index}`}>
                    <button type="button" onClick={() => setOpenIndex(index)}>
                        Otvori prijavu {index + 1}
                    </button>
                    <InlineLoginDialog
                        description="Prijavi se za nastavak."
                        onOpenChange={(open) =>
                            setOpenIndex(open ? index : null)
                        }
                        open={openIndex === index}
                    />
                </div>
            ))}
        </QueryClientProvider>
    );
}
