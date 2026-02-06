import "dotenv/config";
import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";
import { parseUnits } from "viem";
import { CHAINS, type ChainKey } from "./chains.js";
import { mustGetEnv, isAddressLike } from "./utils.js";
import { proveWithService } from "./prove.js";
import { sendQuantumTransferZK } from "./send.js";
import { header, card, kvTable, link } from "./ui.js";

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

function explorerTx(chain: ChainKey, txHash: string) {
  if (chain === "bnb") return `https://bscscan.com/tx/${txHash}`;
  return `https://etherscan.io/tx/${txHash}`;
}

function printHelp() {
  header();
  card("Commands", [
    chalk.white("npm run pqc"),
    chalk.white("npm run pqc -- --help"),
    "",
    chalk.bold("Flags"),
    chalk.white("--dry-run") + chalk.dim("   (collect inputs, show summary, do not prove/send)"),
    chalk.white("--fake") + chalk.dim("      (ask prover for fake proof, if your service supports it)"),
    chalk.white("--chain eth|bnb") + chalk.dim(" (optional preselect chain)"),
    chalk.white("--recipient 0x..") + chalk.dim(" (optional prefill)"),
    chalk.white("--amount 1.25") + chalk.dim("  (optional prefill)"),
    chalk.white("--title \"PQC DEMO #1\"") + chalk.dim(" (optional prefill)"),
    "",
    chalk.bold("Security"),
    chalk.dim("Use a burner wallet. Never commit .env. Keep your PK private.")
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

  const preChain = (argValue("--chain") as ChainKey | undefined);
  const preRecipient = argValue("--recipient");
  const preAmount = argValue("--amount");
  const preTitle = argValue("--title");

  const { chainKey } = await inquirer.prompt<{ chainKey: ChainKey }>([
    {
      type: "list",
      name: "chainKey",
      message: "Select network:",
      choices: [
        { name: CHAINS.bnb.label, value: "bnb" },
        { name: CHAINS.eth.label, value: "eth" }
      ],
      when: () => !preChain
    }
  ]);

  const chain = (preChain ?? chainKey) as ChainKey;
  const chainCfg = CHAINS[chain];

  const { recipient } = await inquirer.prompt<{ recipient: string }>([
    {
      type: "input",
      name: "recipient",
      message: "Recipient address (0x…):",
      default: preRecipient,
      validate: (v) => (isAddressLike(v) ? true : "Invalid address"),
      when: () => !preRecipient
    }
  ]);

  const rcpt = preRecipient ?? recipient;

  const { amountHuman } = await inquirer.prompt<{ amountHuman: string }>([
    {
      type: "input",
      name: "amountHuman",
      message: "Amount (human, e.g. 1.25):",
      default: preAmount,
      validate: (v) => {
        const x = Number(v);
        return Number.isFinite(x) && x > 0 ? true : "Invalid amount";
      },
      when: () => !preAmount
    }
  ]);

  const amt = preAmount ?? amountHuman;

  const { title } = await inquirer.prompt<{ title: string }>([
    {
      type: "input",
      name: "title",
      message: "ISO Reference title:",
      default: preTitle ?? "PQC DEMO"
    }
  ]);

  const deadlineMinutes = Number(process.env.DEFAULT_DEADLINE_MINUTES || "30");
  const isoReference = buildIsoReference({
    project: "QRYPTA",
    title,
    chain,
    recipient: rcpt,
    amountHuman: amt
  });

  // Read env only when needed
  const rpcUrl = process.env[chainCfg.rpcEnv] || "";
  const contract = process.env[chainCfg.contractEnv] || "";
  const proverUrl = process.env.PROVER_URL || "";
  const hasEnv = Boolean(rpcUrl && contract && proverUrl);

  const amountWei = parseUnits(amt, 18).toString();

  card("Step 1/3 — Summary", []);
  kvTable([
    ["Network", chainCfg.label],
    ["Recipient", rcpt],
    ["Amount", `${amt} (wei: ${amountWei})`],
    ["Deadline", `~${deadlineMinutes} minutes`],
    ["ISO Ref", isoReference],
    ["Mode", dryRun ? "DRY-RUN (no prove/send)" : fake ? "FAKE proof (if prover supports)" : "REAL proof"]
  ]);

  if (dryRun) {
    console.log(chalk.yellow("\nDry-run enabled. Exiting without proving or sending.\n"));
    return;
  }

  if (!hasEnv) {
    console.log(chalk.red("\nMissing .env config.\n"));
    console.log(chalk.dim("Required: RPC_*, QRYP_CONTRACT_*, OWNER_PK, PROVER_URL"));
    console.log(chalk.dim("Tip: cp .env.example .env && edit .env (never commit it)"));
    process.exit(1);
  }

  // Strict env reads (only now)
  const rpcUrl2 = mustGetEnv(chainCfg.rpcEnv);
  const contract2 = mustGetEnv(chainCfg.contractEnv);
  const ownerPk = mustGetEnv("OWNER_PK");
  const proverUrl2 = mustGetEnv("PROVER_URL");

  // PROVE
  card("Step 2/3 — Proving", [
    chalk.dim("Calling prover service to generate SP1 proof…"),
    chalk.dim(`PROVER_URL: ${proverUrl2}`)
  ]);

  const sp = ora("Generating proof…").start();
  const proved = await proveWithService(proverUrl2, {
    chain,
    recipient: rcpt,
    amountWei,
    isoReference,
    fake,
    deadlineMinutes
  }).catch((e) => {
    sp.fail("Proof generation failed.");
    throw e;
  });
  sp.succeed("Proof ready.");

  kvTable([
    ["isoRefHash", proved.isoRefHash ?? "(not provided)"],
    ["publicValues", `${proved.publicValues.slice(0, 24)}…`],
    ["proofBytes", `${proved.proofBytes.slice(0, 24)}…`]
  ]);

  // SEND
  card("Step 3/3 — Broadcast", [
    chalk.dim("Submitting quantumTransferZK on-chain…"),
    chalk.dim(`Contract: ${contract2}`)
  ]);

  const ss = ora("Broadcasting tx…").start();
  const sent = await sendQuantumTransferZK({
    chain: chainCfg.chain,
    rpcUrl: rpcUrl2,
    contract: contract2,
    ownerPk,
    recipient: rcpt,
    amountHuman: amt,
    publicValues: proved.publicValues,
    proofBytes: proved.proofBytes,
    isoReference
  }).catch((e) => {
    ss.fail("Transaction failed.");
    throw e;
  });
  ss.succeed("Confirmed.");

  const txUrl = explorerTx(chain, String(sent.hash));

  kvTable([
    ["txHash", String(sent.hash)],
    ["Explorer", txUrl],
    ["status", String(sent.receipt.status)],
    ["block", String(sent.receipt.blockNumber)],
    ["gasUsed", String(sent.receipt.gasUsed)]
  ]);

  console.log("\n" + chalk.greenBright("Done ✅"));
  console.log(link("Open", txUrl) + "\n");
}

main().catch((e) => {
  console.error(chalk.red("\nERROR:"), e?.message || e);
  process.exit(1);
});
