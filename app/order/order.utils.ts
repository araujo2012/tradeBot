import { intervalData } from "./order.constants";
import { IntervalType } from "./order.type";

export const getSpeed = ({
  speed,
  interval,
}: {
  speed: number;
  interval: IntervalType;
}) => {
  const total =
    1 + speed * (1 + speed * (1 + speed * (1 + speed * (1 + speed))));
  return Math.pow(speed, intervalData[interval].entry) / total;
};
