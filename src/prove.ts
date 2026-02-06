import { asHex } from "./utils.js";

export type ProveRequest = {
  chain: "eth" | "bnb";
  recipient: string;
  amountWei: string;
  isoReference: string;
  fake?: boolean;
  deadlineMinutes?: number;
};

export type ProveResponse = {
  publicValues: `0x${string}`;
  proofBytes: `0x${string}`;
  isoRefHash?: `0x${string}`;
  deadline?: number;
};

export async function proveWithService(
  proverUrl: string,
  req: ProveRequest
): Promise<ProveResponse> {
  const r = await fetch(`${proverUrl.replace(/\/$/, "")}/prove`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chain: req.chain,
      recipient: req.recipient,
      amount: req.amountWei,
      isoReference: req.isoReference,
      fake: req.fake ?? false,
      deadlineMinutes: req.deadlineMinutes
    })
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Prover error (${r.status}): ${t || r.statusText}`);
  }

  const j = (await r.json()) as any;

  if (!j.publicValues || !j.proofBytes) {
    throw new Error(`Invalid prover response: expected { publicValues, proofBytes }`);
  }

  return {
    publicValues: asHex(String(j.publicValues)),
    proofBytes: asHex(String(j.proofBytes)),
    isoRefHash: j.isoRefHash ? asHex(String(j.isoRefHash)) : undefined,
    deadline: typeof j.deadline === "number" ? j.deadline : undefined
  };
}
