import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { sepolia, tronShasta } from 'viem/chains'

// Define custom chains for new networks
const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://monad-testnet.drpc.org'] }
  },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: 'https://explorer.monad.xyz' }
  }
} as const

  

import App from './App.tsx'
import './index.css'

import '@rainbow-me/rainbowkit/styles.css'

// Configure wagmi
const config = getDefaultConfig({
  appName: '1inch Fusion+ Bridge',
  projectId: 'YOUR_PROJECT_ID', // Get from WalletConnect Cloud
  chains: [sepolia,  monadTestnet, tronShasta],
  ssr: false,
})

// Create a client for React Query
const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)