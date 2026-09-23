import { ReactNode } from "react";
import { ThemeProvider } from "@/shared/components/layout/ThemeProvider";
import { AuthProvider } from "@/features/auth";

type AppProviderProps = {
  children: ReactNode;
};

export const AppProvider = ({ children }: AppProviderProps) => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
};
