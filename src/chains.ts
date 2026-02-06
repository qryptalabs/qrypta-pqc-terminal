import { mainnet, bsc } from "viem/chains";

export type ChainKey = "eth" | "bnb";

export const DEFAULTS = {
  rpc: {
    eth: "https://ethereum-rpc.publicnode.com",
    bnb: "https://bsc-rpc.publicnode.com"
  },
  explorer: {
    eth: {
      tx: (h: string) => `https://etherscan.io/tx/${h}`,
      address: (a: string) => `https://etherscan.io/address/${a}`,
      token: (a: string) => `https://etherscan.io/token/${a}`
    },
    bnb: {
      tx: (h: string) => `https://bscscan.com/tx/${h}`,
      address: (a: string) => `https://bscscan.com/address/${a}`,
      token: (a: string) => `https://bscscan.com/token/${a}`
    }
  },
  contract: {
    eth: "0x5266fe1aD9B035d0ED6142f1A70e9D6F102c8153",
    bnb: "0x5266fe1aD9B035d0ED6142f1A70e9D6F102c8153"
  }
};

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
