
export const formatId = (num: number, prefix: string): string => {
  return `${prefix}-${String(num).padStart(3, '0')}`;
};
