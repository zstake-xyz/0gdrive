import React from 'react';
import { Providers } from './providers';
import UploadCardContainer from '@/components/upload/UploadCardContainer';
import ConnectButton from '@/components/ConnectButton';
import { PoweredBy } from '@/components/common/PoweredBy';

// Client-only page to avoid hydration mismatches
export function ClientPage() {
  return (
    <Providers>
      <main className="min-h-screen bg-brand-background-light">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-end items-center space-x-4 mb-8">
            <ConnectButton />
          </div>
          <div className="space-y-12">
            <UploadCardContainer />
          </div>
        </div>
        <PoweredBy />
      </main>
    </Providers>
  );
} 