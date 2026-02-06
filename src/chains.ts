import { mainnet, bsc } from "viem/chains";

export type ChainKey = "eth" | "bnb";

export const CHAINS = {
  eth: {
    key: "eth" as const,
    label: "Ethereum Mainnet",
    chain: mainnet,
    rpcEnv: "RPC_ETH",
    contractEnv: "QRYP_CONTRACT_ETH"
  },
  bnb: {
    key: "bnb" as const,
    label: "BNB Chain (BSC) Mainnet",
    chain: bsc,
    rpcEnv: "RPC_BNB",
    contractEnv: "QRYP_CONTRACT_BNB"
  }
};
