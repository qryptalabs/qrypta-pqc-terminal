import chalk from "chalk";

export function neonProgress(label: string) {
  const width = 26;
  let pos = 0;
  let dir = 1;
  const start = Date.now();

  function render() {
    // bouncing block
    const cells = Array.from({ length: width }, (_, i) => (i === pos ? "█" : "░"));
    const bar = cells.join("");

    // neon-ish color sweep (cyan → magenta look)
    const colored =
      chalk.cyan(bar.slice(0, Math.max(0, pos))) +
      chalk.magenta(bar.slice(Math.max(0, pos), pos + 1)) +
      chalk.cyan(bar.slice(pos + 1));

    const elapsed = Math.floor((Date.now() - start) / 1000);
    process.stdout.write(`\x1b[2K\r${chalk.bold(label)} ${colored} ${chalk.dim(`${elapsed}s`)}`);

    pos += dir;
    if (pos <= 0 || pos >= width - 1) dir *= -1;
  }

  const timer = setInterval(render, 80);
  render();

  return {
    stopOk(msg = "OK") {
      clearInterval(timer);
      process.stdout.write(`\x1b[2K\r${chalk.bold(label)} ${chalk.green("✔")} ${chalk.dim(msg)}\n`);
    },
    stopFail(msg = "FAILED") {
      clearInterval(timer);
      process.stdout.write(`\x1b[2K\r${chalk.bold(label)} ${chalk.red("✖")} ${chalk.dim(msg)}\n`);
    }
  };
}
