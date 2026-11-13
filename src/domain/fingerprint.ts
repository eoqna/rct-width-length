// 퍼즐 지문: 격자의 FNV-1a 32비트 해시 (design.md §4.3, A6)
// 격자가 바뀌면 저장된 진행을 버리기 위해 쓴다. 열쇠 문구만 고친 경우는 진행을 유지한다.

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function fnv1a(text: string): string {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function fingerprintGrid(grid: readonly string[]): string {
  return fnv1a(grid.join('\n'));
}
