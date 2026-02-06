import "dotenv/config";
import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";
import boxen from "boxen";
import gradient from "gradient-string";
import { CHAINS, type ChainKey } from "./chains.js";
import { mustGetEnv, isAddressLike } from "./utils.js";
import { proveWithService } from "./prove.js";
import { sendQuantumTransferZK } from "./send.js";
import { parseUnits } from "viem";

function printHeader() {
  const art = `
 ██████╗ ██████╗ ██╗   ██╗██████╗ ████████╗ █████╗
██╔═══██╗██╔══██╗╚██╗ ██╔╝██╔══██╗╚══██╔══╝██╔══██╗
██║   ██║██████╔╝ ╚████╔╝ ██████╔╝   ██║   ███████║
██║▄▄ ██║██╔══██╗  ╚██╔╝  ██╔═══╝    ██║   ██╔══██║
╚██████╔╝██║  ██║   ██║   ██║        ██║   ██║  ██║
 ╚══▀▀═╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝        ╚═╝   ╚═╝  ╚═╝
`;
  console.log(gradient(["#00E5FF", "#9B5CFF", "#00FFB2"])(art));
  console.log(
    boxen(
      chalk.bold("PQC Terminal Demo") +
        "\n" +
        chalk.dim("SP1 proof → quantumTransferZK → on-chain receipt"),
      { padding: 1, borderStyle: "round", borderColor: "cyan" }
    )
  );
}

function printHelp() {
  console.log(`
Usage:
  npm run pqc
  npm run pqc -- --help

Notes:
  - .env is NOT committed (safe)
  - PROVER_URL must return { publicValues, proofBytes }
`);
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

function summaryBox(data: Record<string, string>) {
  const lines = Object.entries(data)
    .map(([k, v]) => `${chalk.cyan(k)}: ${chalk.white(v)}`)
    .join("\n");
  console.log(boxen(lines, { padding: 1, borderStyle: "round", borderColor: "magenta" }));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHeader();
    printHelp();
    return;
  }

  printHeader();

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

  // env + configs
  const rpcUrl = mustGetEnv(chainCfg.rpcEnv);
  const contract = mustGetEnv(chainCfg.contractEnv);
  const ownerPk = mustGetEnv("OWNER_PK");
  const proverUrl = mustGetEnv("PROVER_URL");

  const amountWei = parseUnits(amountHuman, 18).toString();

  summaryBox({
    Network: chainCfg.label,
    Contract: contract,
    Recipient: recipient,
    Amount: `${amountHuman} (wei: ${amountWei})`,
    Deadline: `~${deadlineMinutes} minutes`,
    "ISO Ref": isoReference
  });

  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    { type: "confirm", name: "confirm", message: "Generate proof + broadcast now?", default: false }
  ]);

  if (!confirm) {
    console.log(chalk.yellow("Cancelled."));
    process.exit(0);
  }

  const sp = ora("Generating SP1 proof…").start();
  const proved = await proveWithService(proverUrl, {
    chain: chainKey,
    recipient,
    amountWei,
    isoReference,
    fake: false,
    deadlineMinutes
  }).catch((e) => {
    sp.fail("Proof generation failed.");
    throw e;
  });
  sp.succeed("Proof generated.");

  summaryBox({
    isoRefHash: proved.isoRefHash ? proved.isoRefHash : "(not provided)",
    publicValues: `${proved.publicValues.slice(0, 18)}…`,
    proofBytes: `${proved.proofBytes.slice(0, 18)}…`
  });

  const ss = ora("Broadcasting quantumTransferZK…").start();
  const sent = await sendQuantumTransferZK({
    chain: chainCfg.chain,
    rpcUrl,
    contract,
    ownerPk,
    recipient,
    amountHuman,
    publicValues: proved.publicValues,
    proofBytes: proved.proofBytes,
    isoReference
  }).catch((e) => {
    ss.fail("Transaction failed.");
    throw e;
  });
  ss.succeed("Transaction confirmed.");

  summaryBox({
    txHash: String(sent.hash),
    status: String(sent.receipt.status),
    block: String(sent.receipt.blockNumber),
    gasUsed: String(sent.receipt.gasUsed)
  });

  console.log(chalk.greenBright("Done ✅"));
}

main().catch((e) => {
  console.error(chalk.red("\nERROR:"), e?.message || e);
  process.exit(1);
});
