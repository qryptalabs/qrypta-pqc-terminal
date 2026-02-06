import chalk from "chalk";
import boxen from "boxen";
import gradient from "gradient-string";
import Table from "cli-table3";

export function header() {
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

export function card(title: string, lines: string[]) {
  const content = [chalk.bold(title), ...lines].join("\n");
  console.log(
    boxen(content, {
      padding: 1,
      borderStyle: "round",
      borderColor: "magenta"
    })
  );
}

export function kvTable(rows: Array<[string, string]>) {
  const table = new Table({
    style: { head: [], border: [] },
    colWidths: [18, 90],
    wordWrap: true
  });
  rows.forEach(([k, v]) => table.push([chalk.cyan(k), v]));
  console.log(table.toString());
}

export function link(label: string, url: string) {
  return `${chalk.cyan(label)}: ${chalk.underline(url)}`;
}
