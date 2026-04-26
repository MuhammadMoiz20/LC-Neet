export type CxArg = string | false | undefined | null | 0;

export function cx(...args: CxArg[]): string {
  return args.filter(Boolean).join(' ');
}
