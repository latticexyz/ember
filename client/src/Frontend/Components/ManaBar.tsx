import React, { useRef, useState } from "react";
import manaBar from "../../Assets/img/manaBar.png";
import emptyBar from "../../Assets/img/greyManaBar.png";
import { usePrevious } from "../Hooks/usePrevious";
import styled from "styled-components";
import usePortal from "react-useportal";
import { StandardTooltip, TooltipDirection } from "./Tooltips";

interface Props {
  amount: number;
  maxAmount: number;
  regen: number;
  title: string;
  text: string;
  direction: TooltipDirection;
}

const Container = styled.div`
  display: flex;
  justify-content: start;
  z-index: 1;
  position: absolute;
  padding-top: 182px;
`;

const MANABAR_HEIGHT = 200;

export const ManaBar = React.memo(({
  amount, 
  maxAmount,
  regen,
  title,
  text,
  direction,
}: Props)  => {
  const prevAmount = usePrevious(amount);
  const safePrevAmount = prevAmount ? prevAmount : amount;
  const safeMaxAmount = maxAmount ? maxAmount : 0;
  const percentage = (safePrevAmount/safeMaxAmount);
  const height = MANABAR_HEIGHT * percentage;

  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { Portal, openPortal, closePortal, isOpen } = usePortal();
  return (
    <Container
      ref={tooltipRef}
      onMouseEnter={(e) => {
        setShowTooltip(true);
        openPortal(e);
      }}
      onMouseLeave={(e) => {
        setShowTooltip(false);
        closePortal(e);
      }}
    >
      <img style={{marginLeft: "190px", zIndex: 4}} width={15} height={MANABAR_HEIGHT} src={emptyBar} />
      <img style={{marginLeft: "190px", zIndex: 5, position: "absolute"}} width={15} height={height} src={manaBar} />
      {showTooltip && tooltipRef.current && isOpen && (
        <Portal>
          <StandardTooltip
            title={title}
            text={text}
            direction={direction}
            parent={tooltipRef.current.getBoundingClientRect()}
            stats={[
              ["Current Mana", safePrevAmount],
              ["Max Mana", safeMaxAmount],
              ["Seconds per Mana", regen],
            ]}
          />
        </Portal>
      )}
    </Container>
  );
});