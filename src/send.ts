import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Chain } from "viem";
import { QRYP_ABI } from "./abi.js";
import { asHex } from "./utils.js";

export async function sendQuantumTransferZK(args: {
  chain: Chain;
  rpcUrl: string;
  contract: string;
  ownerPk: string;
  recipient: string;
  amountHuman: string;
  publicValues: `0x${string}`;
  proofBytes: `0x${string}`;
  isoReference: string;
  decimals?: number;
}) {
  const decimals = args.decimals ?? 18;
  const amountWei = parseUnits(args.amountHuman, decimals);

  const account = privateKeyToAccount(asHex(args.ownerPk));

  const walletClient = createWalletClient({
    chain: args.chain,
    transport: http(args.rpcUrl),
    account
  });

  const publicClient = createPublicClient({
    chain: args.chain,
    transport: http(args.rpcUrl)
  });

  const hash = await walletClient.writeContract({
    address: asHex(args.contract),
    abi: QRYP_ABI,
    functionName: "quantumTransferZK",
    args: [
      asHex(args.recipient),
      amountWei,
      args.publicValues,
      args.proofBytes,
      args.isoReference
    ]
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return { hash, receipt, amountWei: amountWei.toString() };
}
