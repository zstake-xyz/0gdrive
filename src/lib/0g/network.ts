import { NetworkType } from '@/app/providers';

export interface NetworkConfig {
  name: string;
  flowAddress: string;
  mineAddress: string;
  marketAddress: string;
  rewardAddress: string;
  storageRpc: string;
  explorerUrl: string;
  l1Rpc: string;
}

/**
 * Gets network configuration based on network type
 * @param networkType The network type ('standard' or 'turbo')
 * @returns The network configuration
 */
export function getNetworkConfig(networkType: NetworkType): NetworkConfig {
  const NETWORKS: Record<string, NetworkConfig> = {
    standard: {
      name: '0G-Galileo-Testnet',
      flowAddress: process.env.NEXT_PUBLIC_FLOW_ADDRESS || '0xbD75117F80b4E22698D0Cd7612d92BDb8eaff628',
      mineAddress: process.env.NEXT_PUBLIC_MINE_ADDRESS || '0x3A0d1d67497Ad770d6f72e7f4B8F0BAbaa2A649C',
      marketAddress: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '0x53191725d260221bBa307D8EeD6e2Be8DD265e19',
      rewardAddress: process.env.NEXT_PUBLIC_REWARD_ADDRESS || '0xd3D4D91125D76112AE256327410Dd0414Ee08Cb4',
      storageRpc: process.env.NEXT_PUBLIC_STORAGE_RPC || 'https://indexer-storage-testnet-standard.0g.ai',
      explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://chainscan-galileo.0g.ai/tx/',
      l1Rpc: process.env.NEXT_PUBLIC_L1_RPC || 'https://evmrpc-testnet.0g.ai'
    },
    turbo: {
      name: '0G-Galileo-Testnet (Turbo)',
      flowAddress: process.env.NEXT_PUBLIC_FLOW_ADDRESS || '0xbD75117F80b4E22698D0Cd7612d92BDb8eaff628',
      mineAddress: process.env.NEXT_PUBLIC_MINE_ADDRESS || '0x3A0d1d67497Ad770d6f72e7f4B8F0BAbaa2A649C',
      marketAddress: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '0x53191725d260221bBa307D8EeD6e2Be8DD265e19',
      rewardAddress: process.env.NEXT_PUBLIC_REWARD_ADDRESS || '0xd3D4D91125D76112AE256327410Dd0414Ee08Cb4',
      storageRpc: process.env.NEXT_PUBLIC_STORAGE_RPC || 'https://indexer-storage-testnet-turbo.0g.ai',
      explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://chainscan-galileo.0g.ai/tx/',
      l1Rpc: process.env.NEXT_PUBLIC_L1_RPC || 'https://evmrpc-testnet.0g.ai'
    }
  };
  
  return NETWORKS[networkType];
}

/**
 * Gets explorer URL for a transaction hash
 * @param txHash The transaction hash
 * @param networkType The network type
 * @returns The explorer URL
 */
export function getExplorerUrl(txHash: string, networkType: NetworkType): string {
  const network = getNetworkConfig(networkType);
  return network.explorerUrl + txHash;
} 