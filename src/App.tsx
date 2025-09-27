import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useChainId } from 'wagmi'
import { ModernBridge } from '@/components/ModernBridge'
import { TronConnectButton } from '@/components/TronConnectButton'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { NETWORKS } from '@/config/contracts'
import { 
  Zap, 
  Github, 
  Twitter, 
  Globe, 
  Activity, 
  AlertTriangle,
  ExternalLink,
  Shield,
  Clock,
  ArrowRightLeft
} from 'lucide-react'

function App() {
  const { isConnected, address } = useAccount()
  const chainId = useChainId()

  const isNetworkSupported = () => {
    return Object.values(NETWORKS).some(network => network.chainId === chainId)
  }

  const getCurrentNetwork = () => {
    const network = Object.entries(NETWORKS).find(([_, config]) => config.chainId === chainId)
    return network ? network[1] : null
  }

  const currentNetwork = getCurrentNetwork()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
           

          {/* Wallet Connect Buttons */}
          <div className="flex items-center gap-3 left-0">
            <ConnectButton />
            <TronConnectButton />
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        

        {/* Network Warning */}
        {isConnected && !isNetworkSupported() && (
          <div className="max-w-2xl mx-auto mb-8">
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You're connected to an unsupported network. Please switch to Ethereum Sepolia or connect TronLink for Tron Shasta to use the bridge.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Main Bridge Interface */}
        <div className="flex justify-center mb-16">
          <ModernBridge />
        </div>
      </main>

      
    </div>
  )
}

export default App