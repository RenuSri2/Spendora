'use client';

import { SessionProvider } from 'next-auth/react';
import { MascotProvider } from '@/components/providers/MascotProvider';

export function RootLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <MascotProvider>
        {children}
      </MascotProvider>
    </SessionProvider>
  );
}
