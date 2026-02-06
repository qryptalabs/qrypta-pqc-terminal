import "dotenv/config";
import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";
import { formatEther, parseUnits } from "viem";
import { CHAINS, DEFAULTS, type ChainKey } from "./chains.js";
import { mustGetEnv, isAddressLike } from "./utils.js";
import { proveWithService } from "./prove.js";
import { sendQuantumTransferZK } from "./send.js";
import { header, card, kvTable, link } from "./ui.js";
import { neonProgress } from "./progress.js";

function argFlag(name: string) {
  return process.argv.includes(name);
}
function argValue(name: string): string | undefined {
  const i = process.argv.findIndex((x) => x === name);
  if (i >= 0) return process.argv[i + 1];
  const pref = process.argv.find((x) => x.startsWith(name + "="));
  if (pref) return pref.split("=").slice(1).join("=");
  return undefined;
}

function getRpc(chain: ChainKey) {
  const envName = CHAINS[chain].rpcEnv;
  return (process.env[envName] && process.env[envName]!.trim()) || DEFAULTS.rpc[chain];
}

function getContract(chain: ChainKey) {
  const envName = CHAINS[chain].contractEnv;
  return (process.env[envName] && process.env[envName]!.trim()) || DEFAULTS.contract[chain];
}

function getProverUrl() {
  return (process.env.PROVER_URL && process.env.PROVER_URL.trim()) || "http://localhost:8787";
}

function buildIsoReference(p: {
  project: string;
  title: string;
  chain: ChainKey;
  recipient: string;
  amountHuman: string;
}) {
  return JSON.stringify({
    project: p.project,
    title: p.title,
    chain: p.chain,
    recipient: p.recipient,
    amount: p.amountHuman,
    ts: new Date().toISOString()
  });
}

function printHelp() {
  header();
  card("Commands", [
    chalk.white("npm run pqc"),
    chalk.white("npm run pqc -- --help"),
    "",
    chalk.bold("Flags"),
    chalk.white("--dry-run") + chalk.dim("   (inputs + report only, no prove/send)"),
    chalk.white("--fake") + chalk.dim("      (ask prover for fake proof, if service supports)"),
    "",
    chalk.bold("Defaults"),
    chalk.dim("RPCs are public by default (override via RPC_ETH / RPC_BNB if you want)."),
    chalk.dim("Contracts can default to QRYPTA deployments (override via QRYP_CONTRACT_*).")
  ]);
}

async function main() {
  if (argFlag("--help") || argFlag("-h")) {
    printHelp();
    return;
  }

  const dryRun = argFlag("--dry-run");
  const fake = argFlag("--fake");

  header();

  const { chainKey } = await inquirer.prompt<{ chainKey: ChainKey }>([
    {
      type: "list",
      name: "chainKey",
      message: "Select network:",
      choices: [
        { name: CHAINS.bnb.label, value: "bnb" },
        { name: CHAINS.eth.label, value: "eth" }
      ]
    }
  ]);

  const chainCfg = CHAINS[chainKey];

  const { recipient } = await inquirer.prompt<{ recipient: string }>([
    {
      type: "input",
      name: "recipient",
      message: "Recipient address (0x…):",
      validate: (v) => (isAddressLike(v) ? true : "Invalid address")
    }
  ]);

  const { amountHuman } = await inquirer.prompt<{ amountHuman: string }>([
    {
      type: "input",
      name: "amountHuman",
      message: "Amount (human, e.g. 1.25):",
      validate: (v) => {
        const x = Number(v);
        return Number.isFinite(x) && x > 0 ? true : "Invalid amount";
      }
    }
  ]);

  const { title } = await inquirer.prompt<{ title: string }>([
    { type: "input", name: "title", message: "ISO Reference title:", default: "PQC DEMO" }
  ]);

  const deadlineMinutes = Number(process.env.DEFAULT_DEADLINE_MINUTES || "30");
  const isoReference = buildIsoReference({
    project: "QRYPTA",
    title,
    chain: chainKey,
    recipient,
    amountHuman
  });

  const rpcUrl = getRpc(chainKey);
  const contract = getContract(chainKey);
  const proverUrl = getProverUrl();

  const amountWei = parseUnits(amountHuman, 18).toString();

  card("Step 1/3 — Summary", []);
  kvTable([
    ["Network", chainCfg.label],
    ["RPC", rpcUrl],
    ["Contract", contract],
    ["Contract (Explorer)", DEFAULTS.explorer[chainKey].address(contract)],
    ["Token (Explorer)", DEFAULTS.explorer[chainKey].token(contract)],
    ["Recipient", recipient],
    ["Amount", `${amountHuman} (wei: ${amountWei})`],
    ["Deadline", `~${deadlineMinutes} minutes`],
    ["ISO Ref", isoReference],
    ["Mode", dryRun ? "DRY-RUN" : fake ? "FAKE proof" : "REAL proof"]
  ]);

  if (dryRun) {
    console.log(chalk.yellow("\nDry-run enabled. Exiting without proving or sending.\n"));
    return;
  }

  // real sends require OWNER_PK
  const ownerPk = mustGetEnv("OWNER_PK");

  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    { type: "confirm", name: "confirm", message: "Proceed with REAL send now?", default: false }
  ]);
  if (!confirm) {
    console.log(chalk.yellow("Cancelled."));
    return;
  }

  // Step 2: proving (neon progress)
  card("Step 2/3 — Proving", [
    chalk.dim("Generating SP1 proof via prover service…"),
    chalk.dim(`PROVER_URL: ${proverUrl}`)
  ]);

  const p1 = neonProgress("Proving");
  let proved: any;
  try {
    proved = await proveWithService(proverUrl, {
      chain: chainKey,
      recipient,
      amountWei,
      isoReference,
      fake,
      deadlineMinutes
    });
    p1.stopOk("proof ready");
  } catch (e: any) {
    p1.stopFail("prover error");
    throw e;
  }

  kvTable([
    ["isoRefHash", proved.isoRefHash ?? "(not provided)"],
    ["publicValues", `${proved.publicValues.slice(0, 28)}…`],
    ["proofBytes", `${proved.proofBytes.slice(0, 28)}…`]
  ]);

  // Step 3: broadcast + confirm (neon progress)
  card("Step 3/3 — Broadcast", [chalk.dim("Submitting quantumTransferZK and waiting confirmation…")]);

  const p2 = neonProgress("Broadcast/Confirm");
  let sent: any;
  try {
    sent = await sendQuantumTransferZK({
      chain: chainCfg.chain,
      rpcUrl,
      contract,
      ownerPk,
      recipient,
      amountHuman,
      publicValues: proved.publicValues,
      proofBytes: proved.proofBytes,
      isoReference
    });
    p2.stopOk("confirmed");
  } catch (e: any) {
    p2.stopFail("tx failed");
    throw e;
  }

  const txHash = String(sent.hash);
  const txUrl = DEFAULTS.explorer[chainKey].tx(txHash);

  const gasUsed = sent.receipt.gasUsed ?? 0n;
  const eff = sent.receipt.effectiveGasPrice ?? 0n;
  const feeWei = gasUsed * eff;

  // “CertiK-like” receipt report
  card("On-chain Receipt Report", []);
  kvTable([
    ["txHash", txHash],
    ["Explorer", txUrl],
    ["status", String(sent.receipt.status)],
    ["block", String(sent.receipt.blockNumber)],
    ["from", String(sent.receipt.from)],
    ["to", String(sent.receipt.to)],
    ["method", "quantumTransferZK(...)"],
    ["gasUsed", gasUsed.toString()],
    ["effectiveGasPrice", eff ? `${eff.toString()} wei` : "(n/a)"],
    ["networkFee", eff ? `${formatEther(feeWei)} ${chainKey === "eth" ? "ETH" : "BNB"}` : "(n/a)"],
    ["logs", String(sent.receipt.logs?.length ?? 0)]
  ]);

  console.log("\n" + chalk.greenBright("Done ✅"));
  console.log(link("Open in explorer", txUrl) + "\n");
}

main().catch((e) => {
  console.error(chalk.red("\nERROR:"), e?.message || e);
  process.exit(1);
});
