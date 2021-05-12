import React, { ReactChild, ReactChildren, useRef, useState } from "react";
import { StandardTooltip, TooltipDirection } from ".";
import usePortal from "react-useportal";

interface Props {
  title?: string;
  text: string;
  direction: TooltipDirection;
  shortcut?: string;
  expandedText?: string;
  icon?: string;
  stats?: [string, number][];
  margin?: number;
}

export const Tooltip: React.FC<Props> = ({
  title,
  text,
  direction,
  children,
  shortcut,
  stats,
  margin,
}) => {
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { Portal, openPortal, closePortal, isOpen } = usePortal();
  return (
    <div
      ref={tooltipRef}
      onMouseEnter={(e) => {
        setShowTooltip(true);
        openPortal(e);
      }}
      onMouseLeave={(e) => {
        setShowTooltip(false);
        closePortal(e);
      }}
      style={{zIndex: 99}}
    >
      {children}
      {showTooltip && tooltipRef.current && isOpen && (
        <Portal>
          <StandardTooltip
            title={title}
            text={text}
            direction={direction}
            parent={tooltipRef.current.getBoundingClientRect()}
            shortcut={shortcut}
            stats={stats}
            margin={margin}
          />
        </Portal>
      )}
    </div>
  );
};
