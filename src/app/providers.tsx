'use client';

import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { WagmiConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/config/wagmi';
import { WalletProvider } from '@/context/WalletContext';

// Suppress hydration-related console errors
if (typeof window !== 'undefined') {
  // Save original console.error
  const originalConsoleError = console.error;
  
  // Override console.error to filter out hydration warnings
  console.error = function(...args) {
    // Check if this is a hydration error
    const isHydrationError = 
      args.some(arg => 
        typeof arg === 'string' && (
          arg.includes('hydration') || 
          arg.includes('Hydrate') ||
          arg.includes('text content did not match') || 
          arg.includes('Hydration failed')
        )
      );
    
    // Only log non-hydration errors to the console
    if (!isHydrationError) {
      originalConsoleError.apply(console, args);
    }
  };

  // Intercept XMLHttpRequest to handle Mixed Content issues
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(
    method: string, 
    url: string | URL, 
    async: boolean = true, 
    username?: string | null, 
    password?: string | null
  ) {
    // Log all XHR requests for debugging
    console.log(`[XHR Interceptor] Request: ${method} ${url}`);
    
    // Redirect HTTP requests to proxy for all 0G storage nodes
    if (typeof url === 'string' && url.startsWith('http://47.') && url.includes(':5678')) {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      console.log(`[XHR Interceptor] Redirecting ${url} to proxy: ${proxyUrl}`);
      url = proxyUrl;
    }
    
    return originalXHROpen.call(this, method, url, async, username, password);
  };

  // Also intercept fetch API
  const originalFetch = window.fetch;
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input.toString();
    console.log(`[Fetch Interceptor] Request: ${url}`);
    
    // Redirect HTTP requests to proxy for all 0G storage nodes
    if (url.startsWith('http://47.') && url.includes(':5678')) {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      console.log(`[Fetch Interceptor] Redirecting ${url} to proxy: ${proxyUrl}`);
      return originalFetch.call(this, proxyUrl, init);
    }
    
    return originalFetch.call(this, input, init);
  };
}

// Network context to share network state across components
export type NetworkType = 'standard' | 'turbo';

interface NetworkContextType {
  networkType: NetworkType;
  setNetworkType: React.Dispatch<React.SetStateAction<NetworkType>>;
}

export const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

// Create a client
const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  // Use a default value for initial render to prevent hydration mismatch
  const [networkType, setNetworkType] = useState<NetworkType>('standard');
  const initialized = useRef(false);

  // Initialize network type after mount to avoid hydration issues
  useEffect(() => {
    if (initialized.current) return;
    
    // Delay initialization to ensure we're past hydration phase
    const timer = setTimeout(() => {
      // Get stored network preference
      let initialNetwork: NetworkType = 'standard';
      
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('networkType');
        if (saved === 'turbo') {
          initialNetwork = 'turbo';
        } else {
          // Check environment variable default
          const envDefault = process.env.NEXT_PUBLIC_DEFAULT_NETWORK;
          if (envDefault === 'turbo') {
            initialNetwork = 'turbo';
          }
        }
        
        // Only update state if different from default
        if (initialNetwork !== 'standard') {
          console.log(`[Providers] Setting initial network to ${initialNetwork} after hydration`);
          setNetworkType(initialNetwork);
        }
      }
      
      initialized.current = true;
    }, 100); // Short delay to ensure we're past hydration
    
    return () => clearTimeout(timer);
  }, []);

  // Save network preference when it changes
  useEffect(() => {
    // Skip during first render and before initialization
    if (!initialized.current) return;
    
    if (typeof window !== 'undefined') {
      console.log(`[Providers] Saving network preference: ${networkType}`);
      localStorage.setItem('networkType', networkType);
    }
  }, [networkType]);

  // Use a consistent config during server-side rendering
  const safeConfig = React.useMemo(() => config, []);

  return (
    <WagmiConfig config={safeConfig}>
      <QueryClientProvider client={queryClient}>
        <NetworkContext.Provider value={{ networkType, setNetworkType }}>
          <WalletProvider>
            {children}
          </WalletProvider>
        </NetworkContext.Provider>
      </QueryClientProvider>
    </WagmiConfig>
  );
} 