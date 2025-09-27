import React, { useState, useEffect } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { parseUnits, formatUnits, isAddress } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  NETWORKS,
  ERC20_ABI,
  ESCROW_FACTORY_ABI,
  RESOLVER_ADDRESS,
} from "@/config/contracts";
import { useTronLink } from "@/hooks/useTronLink";
import {
  convertAddressForNetwork,
  isValidTronAddress,
  isValidEthAddress,
} from "@/utils/addressConversion";
import {
  ArrowRightLeft,
  Wallet,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Copy,
  Zap,
  Settings,
  Clock,
  DollarSign,
  ChevronDown,
  Shield,
  Globe,
  Sparkles,
  X
} from "lucide-react";

type NetworkKey = "sepolia" | "monad" | "tron";

const NETWORK_LOGOS = {
  sepolia:
    "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2228%22%20height%3D%2228%22%20fill%3D%22none%22%3E%3Cpath%20fill%3D%22%2325292E%22%20fill-rule%3D%22evenodd%22%20d%3D%22M14%2028a14%2014%200%201%200%200-28%2014%2014%200%200%200%200%2028Z%22%20clip-rule%3D%22evenodd%22%2F%3E%3Cpath%20fill%3D%22url(%23a)%22%20fill-opacity%3D%22.3%22%20fill-rule%3D%22evenodd%22%20d%3D%22M14%2028a14%2014%200%201%200%200-28%2014%2014%200%200%200%200%2028Z%22%20clip-rule%3D%22evenodd%22%2F%3E%3Cpath%20fill%3D%22url(%23b)%22%20d%3D%22M8.19%2014.77%2014%2018.21l5.8-3.44-5.8%208.19-5.81-8.19Z%22%2F%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22m14%2016.93-5.81-3.44L14%204.34l5.81%209.15L14%2016.93Z%22%2F%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22a%22%20x1%3D%220%22%20x2%3D%2214%22%20y1%3D%220%22%20y2%3D%2228%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%3Cstop%20stop-color%3D%22%23fff%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23fff%22%20stop-opacity%3D%220%22%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%22b%22%20x1%3D%2214%22%20x2%3D%2214%22%20y1%3D%2214.77%22%20y2%3D%2222.96%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%3Cstop%20stop-color%3D%22%23fff%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23fff%22%20stop-opacity%3D%22.9%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3C%2Fsvg%3E%0A",
  monad:
    "https://img.notionusercontent.com/s3/prod-files-secure%2F8b536fe4-3bbf-45fc-b661-190b80c94bea%2F23726c6b-16c2-430e-92d7-c144a7a6719b%2FMonad_Logo_-_Default_-_Logo_Mark.svg/size/?exp=1754236333&sig=PrJz3P774ATUTnQ2P9zIIytQ5txVKJL7xjFN8WqGidY&id=16863675-94f2-80f6-9f47-f3ec0de0ddcf&table=block",
  tron: "https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png",
};

interface SwapData {
  fromNetwork: NetworkKey;
  toNetwork: NetworkKey;
  amount: string;
  destinationAddress: string;
}

interface TransactionState {
  hash?: `0x${string}`;
  isLoading: boolean;
  isSuccess: boolean;
  error?: string;
}

interface BridgeState {
  isLoading: boolean;
  isSuccess: boolean;
  error?: string;
  showOverlay: boolean;
}

export function ModernBridge() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const {
    writeContract,
    data: writeContractData,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  // TronLink integration
  const {
    isConnected: isTronConnected,
    account: tronAccount,
    balance: tronBalance,
    connect: connectTron,
    disconnect: disconnectTron,
    sendUSDC: sendTronUSDC,
    error: tronError,
    isLoading: tronLoading,
    isTronLinkAvailable,
    approveUSDC,
    checkAllowance,
    allowance
  } = useTronLink();

  // State Management
  const [swapData, setSwapData] = useState<SwapData>({
    fromNetwork: "sepolia",
    toNetwork: "tron",
    amount: "",
    destinationAddress: "",
  });

  const [txState, setTxState] = useState<TransactionState>({
    isLoading: false,
    isSuccess: false,
  });

  const [bridgeState, setBridgeState] = useState<BridgeState>({
    isLoading: false,
    isSuccess: false,
    showOverlay: false,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [slippage, setSlippage] = useState("0.5");
  const [gasPrice, setGasPrice] = useState("standard");

  // Get token balances for all networks
  const { data: sepoliaBalance, refetch: refetchSepoliaBalance } = useBalance({
    address,
    token: NETWORKS.sepolia.usdc as `0x${string}`,
    chainId: NETWORKS.sepolia.chainId,
  });

  const { data: monadBalance, refetch: refetchMonadBalance } = useBalance({
    address,
    token: NETWORKS.monad.usdc as `0x${string}`,
    chainId: NETWORKS.monad.chainId,
  });

  const { data: sepoliaNative } = useBalance({
    address,
    chainId: NETWORKS.sepolia.chainId,
  });

  const { data: monadNative } = useBalance({
    address,
    chainId: NETWORKS.monad.chainId,
  });

  // Get allowances
  const { data: sepoliaAllowance, refetch: refetchSepoliaAllowance } =
    useReadContract({
      address: NETWORKS.sepolia.usdc as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: address
        ? [address, NETWORKS.sepolia.resolver as `0x${string}`]
        : undefined,
      chainId: NETWORKS.sepolia.chainId,
    });

  const { data: monadAllowance, refetch: refetchMonadAllowance } =
    useReadContract({
      address: NETWORKS.monad.usdc as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: address
        ? [address, NETWORKS.monad.resolver as `0x${string}`]
        : undefined,
      chainId: NETWORKS.monad.chainId,
    });

  // Transaction receipt tracking
  const { isLoading: isTxPending, isSuccess: isTxSuccess } =
    useWaitForTransactionReceipt({
      hash: txState.hash,
    });

  useEffect(() => {
    if (isTxSuccess) {
      setTxState((prev) => ({ ...prev, isSuccess: true, isLoading: false }));
      // Refresh balances and allowances
      refetchSepoliaBalance();
      refetchMonadBalance();
      refetchSepoliaAllowance();
      refetchMonadAllowance();
    }
  }, [
    isTxSuccess,
    refetchSepoliaBalance,
    refetchMonadBalance,
    refetchSepoliaAllowance,
    refetchMonadAllowance,
  ]);

  // Handle writeContract data (transaction hash)
  useEffect(() => {
    if (writeContractData) {
      setTxState((prev) => ({
        ...prev,
        hash: writeContractData,
        isLoading: true,
        isSuccess: false,
      }));
    }
  }, [writeContractData]);

  // Handle writeContract errors
  useEffect(() => {
    if (writeError) {
      console.error("Write contract error:", writeError);
      setTxState((prev) => ({
        ...prev,
        isLoading: false,
        isSuccess: false,
        error: writeError.message || "Transaction failed",
      }));
    }
  }, [writeError]);

  const getCurrentNetwork = (): NetworkKey | null => {
    const network = Object.entries(NETWORKS).find(
      ([_, config]) => config.chainId === chainId
    );
    return network ? (network[0] as NetworkKey) : null;
  };

  const currentNetwork = getCurrentNetwork();
  const isNetworkSupported = currentNetwork !== null;

  const getBalance = (network: NetworkKey) => {
    switch (network) {
      case "sepolia":
        return sepoliaBalance;
      case "monad":
        return monadBalance;
      case "tron":
        return tronBalance
          ? {
              value: BigInt(Math.floor(tronBalance.tokenBalance)),
              formatted: tronBalance.tokenBalance,
              decimals: 6,
              symbol: "USDC",
            }
          : { value: BigInt(0), formatted: "0", decimals: 6, symbol: "USDC" };
      default:
        return null;
    }
  };

  const getNativeBalance = (network: NetworkKey) => {
    switch (network) {
      case "sepolia":
        return sepoliaNative;
      case "monad":
        return monadNative;
      case "tron":
        return tronBalance
          ? {
              value: BigInt(Math.floor(tronBalance.balance * 1e6)),
              formatted: tronBalance.balance.toFixed(4),
              decimals: 6,
              symbol: "TRX",
            }
          : { value: BigInt(0), formatted: "0", decimals: 6, symbol: "TRX" };
      default:
        return null;
    }
  };

  const getAllowance = (network: NetworkKey) => {
    switch (network) {
      case "sepolia":
        return sepoliaAllowance;
      case "monad":
        return monadAllowance;
      case "tron":
        return BigInt(Math.floor(allowance * 1e6));
      default:
        return null;
    }
  };

  const formatBalance = (balance: any) => {
    if (!balance) return "0.00";
    return parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4);
  };

  const needsApproval = () => {
    if (!swapData.amount || !address) return false;
    const allowance = getAllowance(swapData.fromNetwork);
    const amountWei = parseUnits(swapData.amount, 6);
    return !allowance || (allowance as bigint) < amountWei;
  };

  const isValidAmount = () => {
    if (!swapData.amount || parseFloat(swapData.amount) <= 0) return false;
    const balance = getBalance(swapData.fromNetwork);
    if (!balance) return false;

    return balance.value >= Number(swapData.amount);
  };

  const isValidDestination = () => {
    if (swapData.toNetwork === "tron") {
      if (!swapData.destinationAddress) return false;
      return isValidTronAddress(swapData.destinationAddress);
    }

    if (!swapData.destinationAddress) return true;
    return (
      isAddress(swapData.destinationAddress) ||
      isValidEthAddress(swapData.destinationAddress)
    );
  };

  const handleSwapNetworks = () => {
    setSwapData((prev) => ({
      ...prev,
      fromNetwork: prev.toNetwork,
      toNetwork: prev.fromNetwork,
    }));
  };

  const handleMaxAmount = () => {
    const balance = getBalance(swapData.fromNetwork);
    if (balance) {
      const formatted = formatUnits(balance.value, balance.decimals);
      setSwapData((prev) => ({ ...prev, amount: formatted }));
    }
  };

  const handleApprove = async () => {
    if (!address || !isNetworkSupported) return;

    if (swapData.fromNetwork === "tron") {
      if (!isTronConnected) {
        console.error("Please connect TronLink first");
        return;
      }

      try {
        setTxState({ isLoading: true, isSuccess: false });
        await approveUSDC(NETWORKS.tron.resolver, swapData.amount);
        setTxState({ isLoading: false, isSuccess: true });
      } catch (error) {
        setTxState({
          isLoading: false,
          isSuccess: false,
          error: (error as Error).message,
        });
      }
      return;
    }

    const sourceChainId = NETWORKS[swapData.fromNetwork].chainId;
    if (chainId !== sourceChainId) {
      await switchChain({ chainId: sourceChainId });
      return;
    }

    setTxState({ isLoading: false, isSuccess: false, error: undefined });

    writeContract({
      address: NETWORKS[swapData.fromNetwork].usdc as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [
        NETWORKS[swapData.fromNetwork].resolver as `0x${string}`,
        parseUnits(swapData.amount, 6),
      ],
    });
  };

  useEffect(() => {
    if (swapData.fromNetwork === "tron" && isTronConnected) {
      checkAllowance(NETWORKS.tron.resolver);
    }
  }, [swapData.fromNetwork, isTronConnected, checkAllowance]);

  const handleBridge = async () => {
    try {
      setBridgeState({
        isLoading: true,
        isSuccess: false,
        error: undefined,
        showOverlay: true,
      });

      let userAddress: string;
      let destinationAddress: string;

      if (swapData.fromNetwork === "tron") {
        if (!isTronConnected || !tronAccount) {
          throw new Error("Please connect TronLink wallet first");
        }
        userAddress = tronAccount.address.base58;

        if (swapData.destinationAddress) {
          if (swapData.toNetwork === "tron") {
            destinationAddress = swapData.destinationAddress;
          } else {
            const convertResult = convertAddressForNetwork(
              swapData.destinationAddress,
              "evm"
            );
            if (!convertResult.isValid) {
              throw new Error(
                `Invalid destination address: ${convertResult.error}`
              );
            }
            destinationAddress = convertResult.address!;
          }
        } else {
          if (swapData.toNetwork === "tron") {
            destinationAddress = userAddress;
          } else {
            if (!address) {
              throw new Error(
                "Please connect MetaMask wallet for EVM destination"
              );
            }
            destinationAddress = address;
          }
        }
      } else {
        if (!isConnected || !address) {
          throw new Error("Please connect MetaMask wallet first");
        }

        const sourceChainId = NETWORKS[swapData.fromNetwork].chainId;
        if (chainId !== sourceChainId) {
          await switchChain({ chainId: sourceChainId });
          return;
        }

        userAddress = address;

        if (swapData.destinationAddress) {
          if (swapData.toNetwork === "tron") {
            const convertResult = convertAddressForNetwork(
              swapData.destinationAddress,
              "tron"
            );
            if (!convertResult.isValid) {
              throw new Error(
                `Invalid destination address: ${convertResult.error}`
              );
            }
            destinationAddress = convertResult.address!;
          } else {
            destinationAddress = swapData.destinationAddress;
          }
        } else {
          if (swapData.toNetwork === "tron") {
            if (!isTronConnected || !tronAccount) {
              throw new Error(
                "Please connect TronLink wallet for Tron destination"
              );
            }
            destinationAddress = tronAccount.address.base58;
          } else {
            destinationAddress = userAddress;
          }
        }
      }

      console.log("Creating cross-chain intent:", {
        fromNetwork: swapData.fromNetwork,
        toNetwork: swapData.toNetwork,
        amount: swapData.amount,
        userAddress,
        destinationAddress,
      });

      const response = await fetch("http://localhost:3001/swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromNetwork: swapData.fromNetwork,
          toNetwork: swapData.toNetwork,
          fromToken: "USDC",
          toToken: "USDC",
          amount: swapData.amount,
          userAddress,
          destinationAddress,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log("✅ Bridge successful:", result);
        setBridgeState({
          isLoading: false,
          isSuccess: true,
          error: undefined,
          showOverlay: true,
        });
      } else {
        console.error("❌ Bridge failed:", result);
        setBridgeState({
          isLoading: false,
          isSuccess: false,
          error: `Bridge error: ${result.error}`,
          showOverlay: true,
        });
      }
    } catch (error: unknown) {
      console.error("Bridge error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Bridge failed";
      setBridgeState({
        isLoading: false,
        isSuccess: false,
        error: errorMessage,
        showOverlay: true,
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const callResolverAPI = async (intentData: any) => {
    try {
      console.log("🔄 Calling resolver API with intent:", intentData);

      const response = await fetch("http://localhost:3001/swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromNetwork: intentData.fromNetwork,
          toNetwork: intentData.toNetwork,
          fromToken: "USDC",
          toToken: "USDC",
          amount: intentData.amount,
          userAddress: intentData.userAddress,
          destinationAddress: intentData.destinationAddress,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log("✅ Resolver API call successful:", result);
        setTxState((prev) => ({
          ...prev,
          isSuccess: true,
          hash: result.orderHash,
          error: undefined,
        }));
      } else {
        console.error("❌ Resolver API call failed:", result);
        setTxState((prev) => ({
          ...prev,
          error: `Resolver error: ${result.error}`,
        }));
      }
    } catch (error: unknown) {
      console.error("❌ Failed to call resolver API:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setTxState((prev) => ({
        ...prev,
        error: `Failed to notify resolver: ${errorMessage}`,
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse animation-delay-500"></div>
      </div>

      <div className="relative min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {/* Main Glass Card */}
          <div className="group relative backdrop-blur-2xl   border border-white/20 rounded-3xl shadow-2xl overflow-hidden transition-all duration-700 hover:border-white/30 ">
            
 
            {/* Header */}
            <div className="relative p-8 pb-6 border-b border-white/10">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative group/logo">
                  
                </div>
                
                <div className="text-center space-y-2">
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
                    Fusion Bridge
                  </h1>
                  <p className="text-white/60 text-sm max-w-md">
                    Seamlessly transfer tokens across multiple blockchain networks with institutional-grade security
                  </p>
                </div>

                {/* Status Pills */}
                <div className="flex justify-center space-x-3 mt-4">
                  <div className="group/pill flex items-center space-x-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-sm hover:bg-emerald-500/20 transition-all duration-300 cursor-pointer">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                    <span className="text-emerald-200 text-xs font-medium">Secure</span>
                    <Shield className="h-3 w-3 text-emerald-300 opacity-0 group-hover/pill:opacity-100 transition-opacity duration-300" />
                  </div>
                  <div className="group/pill flex items-center space-x-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 backdrop-blur-sm hover:bg-blue-500/20 transition-all duration-300 cursor-pointer">
                    <Globe className="h-3 w-3 text-blue-200" />
                    <span className="text-blue-200 text-xs font-medium">Multi-chain</span>
                    <Sparkles className="h-3 w-3 text-blue-300 opacity-0 group-hover/pill:opacity-100 transition-opacity duration-300" />
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="relative p-8 space-y-8">
              {/* Connection Alerts */}
              {!isConnected && !isTronConnected && (
                <div className="group/alert backdrop-blur-sm bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all duration-300">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-full bg-amber-500/20">
                      <AlertTriangle className="h-4 w-4 text-amber-300" />
                    </div>
                    <span className="text-amber-100 text-sm font-medium">Connect your wallet to start bridging tokens</span>
                  </div>
                </div>
              )}

              {(swapData.fromNetwork === "tron" || swapData.toNetwork === "tron") && !isTronConnected && (
                <div className="backdrop-blur-sm bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 hover:bg-amber-500/10 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-full bg-amber-500/20">
                        <AlertTriangle className="h-4 w-4 text-amber-300" />
                      </div>
                      <span className="text-amber-100 text-sm font-medium">TronLink wallet required for Tron network interactions</span>
                    </div>
                    <button
                      onClick={connectTron}
                      disabled={!isTronLinkAvailable || tronLoading}
                      className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-200 text-sm font-medium hover:bg-amber-500/30 hover:border-amber-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {tronLoading ? "Connecting..." : "Connect TronLink"}
                    </button>
                  </div>
                </div>
              )}

              {tronError && (
                <div className="backdrop-blur-sm bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-full bg-red-500/20">
                      <AlertTriangle className="h-4 w-4 text-red-300" />
                    </div>
                    <span className="text-red-100 text-sm">TronLink Error: {tronError}</span>
                  </div>
                </div>
              )}

              {isConnected && !isNetworkSupported && (
                <div className="backdrop-blur-sm bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-full bg-amber-500/20">
                      <AlertTriangle className="h-4 w-4 text-amber-300" />
                    </div>
                    <span className="text-amber-100 text-sm">Switch to Ethereum Sepolia to continue</span>
                  </div>
                </div>
              )}

              {txState.isSuccess && !bridgeState.isLoading && !bridgeState.showOverlay && (
                <div className="backdrop-blur-sm bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-full bg-emerald-500/20">
                      <CheckCircle className="h-4 w-4 text-emerald-300" />
                    </div>
                    <span className="text-emerald-100 text-sm font-medium">Approval successful! You can now bridge your tokens.</span>
                  </div>
                </div>
              )}

              {txState.error && (
                <div className="backdrop-blur-sm bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-full bg-red-500/20">
                      <AlertTriangle className="h-4 w-4 text-red-300" />
                    </div>
                    <span className="text-red-100 text-sm">{txState.error}</span>
                  </div>
                </div>
              )}

              {/* Network Selection */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-semibold text-white flex items-center space-x-2">
                    <span>Bridge Route</span>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  </h3>
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="group/settings flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                  >
                    <Settings className="h-4 w-4 group-hover/settings:rotate-90 transition-transform duration-300" />
                    <span className="text-sm font-medium">Advanced</span>
                  </button>
                </div>

                {/* Network Selection Grid */}
                <div className="grid grid-cols-5 gap-6 items-center">
                  {/* From Network */}
                  <div className="col-span-2 space-y-3">
                    <label className="text-sm font-medium text-white/80 uppercase tracking-wide">From</label>
                    <div className="relative group/from">
                      <select
                        value={swapData.fromNetwork}
                        onChange={(e) =>
                          setSwapData((prev) => ({
                            ...prev,
                            fromNetwork: e.target.value as NetworkKey,
                          }))
                        }
                        className="w-full p-4 pl-14 pr-12 bg-white/5 border border-white/20 rounded-2xl text-white text-sm font-medium focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 appearance-none cursor-pointer backdrop-blur-sm hover:bg-white/10 hover:border-white/30 transition-all duration-300 group-hover/from:shadow-lg group-hover/from:shadow-purple-500/10"
                        disabled={txState.isLoading}
                      >
                        <option value="sepolia" className="bg-slate-800 text-white">Ethereum Sepolia</option>
                        
                        <option value="tron" className="bg-slate-800 text-white">Tron Shasta</option>
                      </select>
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <img
                          key={swapData.fromNetwork}
                          src={NETWORK_LOGOS[swapData.fromNetwork]}
                          alt={NETWORKS[swapData.fromNetwork].name}
                          className="w-6 h-6 rounded-full ring-2 ring-white/20"
                          onError={(e) => {
                            e.currentTarget.src = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2228%22%20height%3D%2228%22%20fill%3D%22none%22%3E%3Ccircle%20cx%3D%2214%22%20cy%3D%2214%22%20r%3D%2214%22%20fill%3D%22%23666%22%2F%3E%3Ctext%20x%3D%2214%22%20y%3D%2218%22%20text-anchor%3D%22middle%22%20fill%3D%22%23fff%22%20font-size%3D%2210%22%20font-family%3D%22monospace%22%3E%3F%3C%2Ftext%3E%3C%2Fsvg%3E";
                          }}
                        />
                      </div>
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <ChevronDown className="h-4 w-4 text-white/40 group-hover/from:text-white/60 transition-colors duration-300" />
                      </div>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={handleSwapNetworks}
                      disabled={txState.isLoading}
                      className="group/swap relative p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/20 hover:from-purple-500/30 hover:to-blue-500/30 hover:border-white/30 hover:scale-110 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                    >
                      <ArrowRightLeft className="h-5 w-5 text-white group-hover/swap:rotate-180 transition-transform duration-500" />
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 opacity-0 group-hover/swap:opacity-100 transition-opacity duration-300"></div>
                    </button>
                  </div>

                  {/* To Network */}
                  <div className="col-span-2 space-y-3">
                    <label className="text-sm font-medium text-white/80 uppercase tracking-wide">To</label>
                    <div className="relative group/to">
                      <select
                        value={swapData.toNetwork}
                        onChange={(e) =>
                          setSwapData((prev) => ({
                            ...prev,
                            toNetwork: e.target.value as NetworkKey,
                          }))
                        }
                        className="w-full p-4 pl-14 pr-12 bg-white/5 border border-white/20 rounded-2xl text-white text-sm font-medium focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 appearance-none cursor-pointer backdrop-blur-sm hover:bg-white/10 hover:border-white/30 transition-all duration-300 group-hover/to:shadow-lg group-hover/to:shadow-blue-500/10"
                        disabled={txState.isLoading}
                      >
                        <option value="sepolia" className="bg-slate-800 text-white">Ethereum Sepolia</option>
                        
                        <option value="tron" className="bg-slate-800 text-white">Tron Shasta</option>
                      </select>
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <img
                          key={swapData.toNetwork}
                          src={NETWORK_LOGOS[swapData.toNetwork]}
                          alt={NETWORKS[swapData.toNetwork].name}
                          className="w-6 h-6 rounded-full ring-2 ring-white/20"
                          onError={(e) => {
                            e.currentTarget.src = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2228%22%20height%3D%2228%22%20fill%3D%22none%22%3E%3Ccircle%20cx%3D%2214%22%20cy%3D%2214%22%20r%3D%2214%22%20fill%3D%22%23666%22%2F%3E%3Ctext%20x%3D%2214%22%20y%3D%2218%22%20text-anchor%3D%22middle%22%20fill%3D%22%23fff%22%20font-size%3D%2210%22%20font-family%3D%22monospace%22%3E%3F%3C%2Ftext%3E%3C%2Fsvg%3E";
                          }}
                        />
                      </div>
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <ChevronDown className="h-4 w-4 text-white/40 group-hover/to:text-white/60 transition-colors duration-300" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white/80 uppercase tracking-wide">Amount</label>
                  {isConnected && (
                    <button
                      onClick={handleMaxAmount}
                      disabled={txState.isLoading}
                      className="px-3 py-1 rounded-lg bg-white/5 border border-white/20 text-white/60 text-xs font-medium hover:text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300 disabled:opacity-50"
                    >
                      MAX
                    </button>
                  )}
                </div>
                <div className="relative group/amount">
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2 pointer-events-none">
                    <div className="p-1.5 rounded-lg bg-white/10">
                      <DollarSign className="h-4 w-4 text-white/80" />
                    </div>
                    <span className="font-semibold text-white/80 text-sm">USDC</span>
                  </div>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={swapData.amount}
                    onChange={(e) =>
                      setSwapData((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    className="w-full h-16 pl-24 pr-6 bg-white/5 border border-white/20 rounded-2xl text-white text-2xl font-bold text-right focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 placeholder:text-white/30 backdrop-blur-sm hover:bg-white/10 hover:border-white/30 transition-all duration-300 group-hover/amount:shadow-lg group-hover/amount:shadow-purple-500/10"
                    disabled={txState.isLoading}
                  />
                </div>
                {swapData.amount && !isValidAmount() && (
                  <p className="text-red-400 text-sm flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Insufficient balance</span>
                  </p>
                )}
              </div>

              {/* Destination Address */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white/80 uppercase tracking-wide">
                    {swapData.toNetwork === "tron" ? "Destination Address (Required)" : "Destination Address (Optional)"}
                  </label>
                  {address && swapData.toNetwork !== "tron" && (
                    <button
                      onClick={() =>
                        setSwapData((prev) => ({
                          ...prev,
                          destinationAddress: address,
                        }))
                      }
                      disabled={txState.isLoading}
                      className="px-3 py-1 rounded-lg bg-white/5 border border-white/20 text-white/60 text-xs font-medium hover:text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300 disabled:opacity-50"
                    >
                      Use My Address
                    </button>
                  )}
                </div>
                <div className="relative group/address">
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <div className="p-2 rounded-lg bg-white/10">
                      <Wallet className="h-4 w-4 text-white/60" />
                    </div>
                  </div>
                  <input
                    placeholder={
                      swapData.toNetwork === "tron"
                        ? "Enter Tron address (T...)"
                        : "0x... (leave empty to use your address)"
                    }
                    value={swapData.destinationAddress}
                    onChange={(e) =>
                      setSwapData((prev) => ({
                        ...prev,
                        destinationAddress: e.target.value,
                      }))
                    }
                    className="w-full p-4 pl-14 pr-6 bg-white/5 border border-white/20 rounded-2xl text-white text-sm font-medium focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder:text-white/30 backdrop-blur-sm hover:bg-white/10 hover:border-white/30 transition-all duration-300 group-hover/address:shadow-lg group-hover/address:shadow-blue-500/10"
                    disabled={txState.isLoading}
                    required={swapData.toNetwork === "tron"}
                  />
                </div>
                {!isValidDestination() && (
                  <p className="text-red-400 text-sm flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>
                      {swapData.toNetwork === "tron" && !swapData.destinationAddress
                        ? "Tron destination address is required"
                        : "Invalid address format"}
                    </span>
                  </p>
                )}
              </div>

              {/* Advanced Settings */}
              {showAdvanced && (
                <div className="space-y-4 p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <h4 className="font-medium text-white/90 flex items-center space-x-2">
                    <Settings className="h-4 w-4" />
                    <span>Advanced Settings</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-white/70">Slippage Tolerance</label>
                      <input
                        value={slippage}
                        onChange={(e) => setSlippage(e.target.value)}
                        placeholder="0.5"
                        className="w-full p-3 bg-white/5 border border-white/20 rounded-xl text-white text-sm focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 backdrop-blur-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-white/70">Gas Price</label>
                      <select
                        value={gasPrice}
                        onChange={(e) => setGasPrice(e.target.value)}
                        className="w-full p-3 bg-white/5 border border-white/20 rounded-xl text-white text-sm focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 backdrop-blur-sm appearance-none cursor-pointer"
                      >
                        <option value="slow" className="bg-slate-800">Slow</option>
                        <option value="standard" className="bg-slate-800">Standard</option>
                        <option value="fast" className="bg-slate-800">Fast</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Bridge Summary */}
              {swapData.amount && parseFloat(swapData.amount) > 0 && isValidAmount() && (
                <div className="space-y-4 p-6 bg-gradient-to-br from-white/5 to-white/10 rounded-2xl border border-white/20 backdrop-blur-sm">
                  <h4 className="font-semibold text-white flex items-center space-x-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <span>Bridge Summary</span>
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">Amount to bridge:</span>
                      <span className="font-semibold text-white">{swapData.amount} USDC</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">Bridge fee:</span>
                      <span className="text-white/90">~0.1%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">Estimated time:</span>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3 text-blue-400" />
                        <span className="text-white/90">2-5 minutes</span>
                      </div>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">You will receive:</span>
                      <span className="font-bold text-lg bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                        ≈{(parseFloat(swapData.amount) * 0.999).toFixed(4)} USDC
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-4">
                {!isConnected ? (
                  <div className="text-center py-8">
                    <div className="space-y-3">
                      <div className="w-16 h-16 mx-auto rounded-full bg-white/5 flex items-center justify-center">
                        <Wallet className="h-8 w-8 text-white/40" />
                      </div>
                      <p className="text-white/60 font-medium">Connect your wallet to continue</p>
                    </div>
                  </div>
                ) : needsApproval() ? (
                  <button
                    onClick={handleApprove}
                    disabled={!isValidAmount() || !isValidDestination() || isWritePending || isTxPending}
                    className="group/approve w-full relative overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-2xl hover:shadow-purple-500/25 hover:scale-[1.02]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-blue-400/20 opacity-0 group-hover/approve:opacity-100 transition-opacity duration-300"></div>
                    <span className="relative z-10 text-lg">
                      {isWritePending ? "Confirming..." : isTxPending ? "Approving..." : `Approve ${swapData.amount || "0"} USDC`}
                    </span>
                    {(isWritePending || isTxPending) && (
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      </div>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleBridge}
                    disabled={!isValidAmount() || !isValidDestination() || isWritePending || isTxPending || bridgeState.isLoading}
                    className="group/bridge w-full relative overflow-hidden bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-2xl hover:shadow-emerald-500/25 hover:scale-[1.02]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-blue-400/20 opacity-0 group-hover/bridge:opacity-100 transition-opacity duration-300"></div>
                    <span className="relative z-10 text-lg">
                      {isWritePending ? "Confirming..." : isTxPending ? "Bridging..." : bridgeState.isLoading ? "Processing..." : `Bridge ${swapData.amount || "0"} USDC`}
                    </span>
                    {(isWritePending || isTxPending || bridgeState.isLoading) && (
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      </div>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bridge Overlay Modal */}
      {bridgeState.showOverlay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => {
                setBridgeState({
                  isLoading: false,
                  isSuccess: false,
                  showOverlay: false,
                  error: undefined,
                });
                setSwapData((prev) => ({
                  ...prev,
                  amount: "",
                  destinationAddress: "",
                }));
                setTxState({ isLoading: false, isSuccess: false });
                window.location.reload();
              }}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all duration-300"
            >
              <X className="h-5 w-5" />
            </button>

            {bridgeState.isLoading && (
              <div className="space-y-6">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 opacity-20"></div>
                  <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-purple-400 border-r-blue-400 animate-spin"></div>
                  <div className="absolute inset-4 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-white animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Processing Bridge</h3>
                  <p className="text-white/70">Your tokens are being transferred cross-chain...</p>
                  <div className="flex justify-center space-x-1 mt-4">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce animation-delay-150"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce animation-delay-300"></div>
                  </div>
                </div>
              </div>
            )}

            {bridgeState.isSuccess && (
              <div className="space-y-6">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-pulse"></div>
                  <div className="absolute inset-2 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle className="w-12 h-12 text-emerald-400" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-emerald-400">Bridge Successful!</h3>
                  <p className="text-white/70">
                    Your tokens have been successfully transferred to{" "}
                    <span className="text-white font-medium">{NETWORKS[swapData.toNetwork].name}</span>
                  </p>
                  <p className="text-white/50 text-sm mt-4">
                    You should see the tokens in your destination wallet within a few minutes.
                  </p>
                </div>
              </div>
            )}

            {bridgeState.error && (
              <div className="space-y-6">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse"></div>
                  <div className="absolute inset-2 rounded-full bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-12 h-12 text-red-400" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-red-400">Bridge Failed</h3>
                  <p className="text-white/70">{bridgeState.error}</p>
                  <p className="text-white/50 text-sm mt-4">
                    Please try again or contact support if the issue persists.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}