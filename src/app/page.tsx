'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Client-only page to avoid hydration mismatches
const ClientOnlyPage = dynamic(
  () => import('./client-page').then(mod => mod.ClientPage),
  { ssr: false }
);

export default function Home() {
  return <ClientOnlyPage />;
}
