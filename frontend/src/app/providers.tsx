"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { isAxiosError } from "axios";
import { Toaster } from "@/components/ui/toaster";

function shouldRetry(failureCount: number, error: unknown): boolean {
  // Never retry client errors — they won't change on retry.
  if (isAxiosError(error) && error.response) {
    const status = error.response.status;
    if (status >= 400 && status < 500) return false;
  }
  // Retry network errors and 5xx up to 3 times.
  return failureCount < 3;
}

const retryDelay = (attempt: number) =>
  // 2 s → 4 s → 8 s, capped at 10 s
  Math.min(2_000 * 2 ** attempt, 10_000);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime:            1000 * 60 * 2,   // 2 min — serve cache without refetch
            gcTime:               1000 * 60 * 30,  // 30 min — keep data alive through outages
            retry:                shouldRetry,
            retryDelay,
            refetchOnWindowFocus: false,
            refetchOnReconnect:   true,  // auto-refresh when connectivity returns
          },
          mutations: {
            // Retry network failures on mutations (e.g. save while signal is weak)
            // but never retry if the server already responded.
            retry: (failureCount, error) => {
              if (isAxiosError(error) && error.response) return false;
              return failureCount < 2;
            },
            retryDelay,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
