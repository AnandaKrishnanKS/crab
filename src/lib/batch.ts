/**
 * Converts a 0-based batch counter index into a batch letter sequence:
 * 0 -> A, 25 -> Z, 26 -> AA, 27 -> AB, 51 -> AZ, 52 -> BA, ...
 */
export function indexToBatchLetter(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("Batch index must be a non-negative integer");
  }
  let n = index;
  let result = "";
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/**
 * Generates an immutable crab code from batch letter and sequential number:
 * ("A", 1) -> "a1", ("AA", 12) -> "aa12"
 */
export function formatCrabCode(batchLetter: string, seq: number): string {
  if (!batchLetter.trim()) {
    throw new Error("Batch letter is required");
  }
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error("Crab sequence must be a positive integer");
  }
  return `${batchLetter.trim().toLowerCase()}${seq}`;
}

export function previewBatchCodes(batchLetter: string, startSeq: number, count: number): string[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, idx) => formatCrabCode(batchLetter, startSeq + idx));
}

