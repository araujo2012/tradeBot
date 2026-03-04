export const normalizeValue = ({
  value,
  decimal,
  isRoundUp,
}: {
  value: number;
  decimal: number;
  isRoundUp: boolean;
}) => {
  value = isRoundUp
    ? Math.ceil(value * Math.pow(10, decimal))
    : Math.floor(value * Math.pow(10, decimal));
  return value / Math.pow(10, decimal);
};
