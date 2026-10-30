"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2, // 2 minutes
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          duration: 4000,
          style: {
            background: "#0f172a",
            color: "#f8fafc",
            border: "1px solid #334155",
            borderRadius: "0.875rem",
            fontSize: "0.8125rem",
            fontWeight: "500",
            padding: "0.625rem 1rem",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
          },
          success: {
            iconTheme: {
              primary: "#10b981",
              secondary: "#022c22",
            },
            style: {
              border: "1px solid rgba(16, 185, 129, 0.4)",
            },
          },
          error: {
            iconTheme: {
              primary: "#f43f5e",
              secondary: "#4c0519",
            },
            style: {
              border: "1px solid rgba(244, 63, 94, 0.4)",
            },
          },
        }}
      />
      {children}
    </QueryClientProvider>
  );
}
