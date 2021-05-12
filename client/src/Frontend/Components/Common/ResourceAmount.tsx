import React from "react";
import { ResourceType } from "../../../_types/GlobalTypes";
import { useSpring, animated, to } from "@react-spring/web";
import { colors } from "../../../theme";
import { Text } from "./Text";
import { usePrevious } from "../../Hooks/usePrevious";

interface Props {
  amount: number;
  maxAmount?: number;
  type: ResourceType;
}

export enum ChangeBreakpoint {
  SMALL,
  MEDIUM,
  LARGE,
  MASSIVE,
}

const breakpointsPerResourceType: BreakpointsPerResourceType = {
  [ResourceType.Gold]: {
    [ChangeBreakpoint.SMALL]: 200,
    [ChangeBreakpoint.MEDIUM]: 500,
    [ChangeBreakpoint.LARGE]: 2000,
    [ChangeBreakpoint.MASSIVE]: 5000,
  },
  [ResourceType.Soul]: {
    [ChangeBreakpoint.SMALL]: 2,
    [ChangeBreakpoint.MEDIUM]: 4,
    [ChangeBreakpoint.LARGE]: 10,
    [ChangeBreakpoint.MASSIVE]: 20,
  },
};

export type BreakpointsPerResourceType = { [key in ResourceType]?: { [key in ChangeBreakpoint]: number } };

export const ResourceAmount = React.memo(({ amount, maxAmount, type }: Props) => {
  const prevAmount = usePrevious(amount);
  const safePrevAmount = prevAmount ? prevAmount : amount;
  const safeMaxAmount = maxAmount ? maxAmount : 0;
  const maxAmountColor = maxAmount ? (amount >= maxAmount ? colors.warning : colors.lightgray) : colors.lightgray;
  const props = useSpring({ amount, maxAmountColor, safeMaxAmount, config: { tension: 80 } });
  const amountChange = Math.abs(safePrevAmount - amount);
  let bumpAmount = 3;
  // const breakpoints = breakpointsPerResourceType[type];
  // if (breakpoints) {
  //   if (amountChange >= breakpoints[ChangeBreakpoint.MASSIVE]) {
  //     bumpAmount = 20;
  //   } else if (amountChange >= breakpoints[ChangeBreakpoint.LARGE]) {
  //     bumpAmount = 14;
  //   } else if (amountChange >= breakpoints[ChangeBreakpoint.MEDIUM]) {
  //     bumpAmount = 10;
  //   } else if (amountChange >= breakpoints[ChangeBreakpoint.SMALL]) {
  //     bumpAmount = 6;
  //   }
  // }
  if (amount - safePrevAmount < 0) {
    // decrease of resource
    bumpAmount = -Math.floor(bumpAmount / 2);
  }
  if (type === ResourceType.Population) {
    bumpAmount = -bumpAmount;
  }
  const animationColor = bumpAmount >= 0 ? colors.green : colors.primary;
  // max amount animation
  return (
    <Text style={{ display: "inline-flex", alignItems: "center", fontSize: "15px" }}>
      <div style={{ position: "relative", display: "inherit" }}>
        <span style={{ opacity: 0 }}>{amount}</span>
        <animated.span
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            fontSize: props.amount
              .to((x) => Math.abs(safePrevAmount - x) / amountChange)
              .to({
                range: [0, 0.2, 0.9, 1.0],
                output: ["12px", Math.max(6, 12 + bumpAmount) + "px", Math.max(6, 12 + bumpAmount) + "px", "12px"],
              }),
            color: props.amount
              .to((x) => Math.abs(safePrevAmount - x) / amountChange)
              .to({ range: [0, 0.2, 0.9, 1.0], output: [colors.white, animationColor, animationColor, colors.white] }),
          }}
        >
          {props.amount.to((x) => (type !== ResourceType.Dai ? x.toFixed(0) : "$" + x.toFixed(4)))}
        </animated.span>
      </div>
      {maxAmount !== undefined && (
        <animated.span
          style={{
            fontSize: "0.7em",
            color: props.maxAmountColor,
          }}
        >
          {props.safeMaxAmount.to((x) => "/" + x.toFixed(0))}
        </animated.span>
      )}
    </Text>
  );
});
