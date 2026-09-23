"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { I18nProvider } from "@/i18n/provider";
import { ThemeProvider, useTheme } from "@/components/theme/theme-provider";
import { isAuthError } from "@/lib/api";

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster position="top-left" dir="rtl" theme={theme} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (count, error) => {
              if (isAuthError(error)) return false;
              return count < 2;
            },
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={client}>
          {children}
          <ThemedToaster />
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
