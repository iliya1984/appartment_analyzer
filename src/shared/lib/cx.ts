/** Joins truthy class names: cx('a', cond && 'b') → "a b". */
export const cx = (...names: (string | false | null | undefined)[]): string =>
  names.filter(Boolean).join(' ');
