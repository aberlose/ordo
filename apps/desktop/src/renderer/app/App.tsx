import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    // Local data: no network, no refetch on focus, no retries hiding real errors.
    queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: false },
    mutations: { retry: false },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
