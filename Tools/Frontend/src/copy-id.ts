// Stable lookup key for host-provided help text. This ID is only used to match UI labels.
export function copyId(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < value.length; i++) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(value.charCodeAt(i))) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

// Counting UTF-16 units also lets the translator skip hashing unrelated strings.
export function copyKey(value: string): string {
  return '#' + value.length + ':' + copyId(value);
}

export function keyLength(value: string): number | undefined {
  const match = /^#(\d+):[0-9a-f]{16}$/.exec(value);
  return match ? Number(match[1]) : undefined;
}
