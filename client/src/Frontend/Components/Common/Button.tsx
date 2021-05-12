import React from "react";
import PixelBorderBox from "./PixelBorderBox";
import { ReactChildren } from "react";
import { ReactChild } from "react";
import { Text } from "./Text";

interface Props {
  onClick?: () => any;
  label?: string;
  style?: any;
  textStyle?: any;
  disabled?: boolean;
  outerColor?: string;
  innerColor?: string;
  backgroundColor?: string;
  children?: ReactChild | ReactChildren;
  primary?: boolean;
}
const PixelButton = ({
  onClick,
  label,
  disabled,
  outerColor,
  innerColor,
  backgroundColor,
  children,
  primary,
}: Props) => (
  <div
    onClick={() => {
      !disabled && onClick && onClick();
    }}
  >
    <PixelBorderBox
      innerColor={primary ? "rgba(244,111,111,1.0)" : innerColor}
      outerColor={primary ? "rgba(244,111,111,0.5)" : outerColor}
      backgroundColor={backgroundColor}
      flex={false}
    >
      {label ? <Text>{label}</Text> : (children as ReactChild | ReactChildren)}
    </PixelBorderBox>
  </div>
);

export default PixelButton;
