export function assertUnreachable(value: never): never {
  throw new Error(`Missed a case! ${value}`);
}
