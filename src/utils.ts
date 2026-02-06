export function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env var: ${name}`);
  return v.trim();
}

export function asHex(x: string): `0x${string}` {
  const v = x.trim();
  if (!v.startsWith("0x")) return (`0x${v}`) as `0x${string}`;
  return v as `0x${string}`;
}

export function isAddressLike(x: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(x.trim());
}
