export const QRYP_ABI = [
  {
    type: "function",
    name: "quantumTransferZK",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "publicValues", type: "bytes" },
      { name: "proofBytes", type: "bytes" },
      { name: "isoReference", type: "string" }
    ],
    outputs: []
  }
] as const;
