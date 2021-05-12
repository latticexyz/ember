// Dynamic positioning for tooltips

import { TooltipDirection } from "../Components/Tooltips";

const SHIFT_FACTOR = 10; //px amount to shift a tooltip to adjust positioning

// the stuff that gets passed to the tooltip component for CSS
export interface DirectionInfo {
  top: number;
  left: number;
  transform: string; // we don't use transform now, but might be useful in the future
}

// describes whether or not a tooltip is inside a bounding box
interface TooltipInside {
  top: boolean; // does the tooltip stay inside the top of the bounding box?
  bottom: boolean;
  left: boolean;
  right: boolean;
}

const getTooltipDirection = (
  dir: TooltipDirection,
  parent: DOMRect,
  tooltip: DOMRect,
  margin?: number
): DirectionInfo => {
  const CenterTop = parent.top + parent.height / 2;
  const CenterLeft = parent.left + parent.width / 2;
  const { height, width } = tooltip;
  let top = CenterTop - height / 2;
  let left = CenterLeft - width / 2;
  let transform = "";
  switch (dir) {
    case TooltipDirection.Top:
      top -= height / 2 + parent.height / 2;
      if (margin) {
        top -= margin;
      }
      break;
    case TooltipDirection.Bottom:
      top += height / 2 + parent.height / 2;
      if (margin) {
        top += margin;
      }
      break;
    case TooltipDirection.Left:
      left -= width / 2 + parent.width / 2;
      if (margin) {
        left -= margin;
      }
      break;
    case TooltipDirection.Right:
      left += width / 2 + parent.width / 2;
      if (margin) {
        left += margin;
      }
      break;
    default:
      left = CenterLeft;
      top = CenterLeft;
      break;
  }
  return { top, left, transform } as DirectionInfo;
};

/*
  Calculate a boundary to make sure the tooltip doesn't go outside of it (i.e. go off-screen),
*/
export const getTooltipBoundary = (keepTooltipInside: string | undefined): DOMRect => {
  // if no container ID is provided, the bounding box is the viewport
  let boundingBox = DOMRectReadOnly.fromRect({
    y: 0,
    x: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  });
  if (typeof keepTooltipInside === "string") {
    const selector = document.getElementById(keepTooltipInside);
    if (process.env.NODE_ENV !== "production") {
      if (selector === null)
        throw new Error(
          `${keepTooltipInside} selector does not exist : keepTooltipInside must be a valid html selector 'Id'`
        );
    }
    if (selector !== null) boundingBox = selector.getBoundingClientRect();
  }

  return boundingBox;
};

const calculateIsInside = (tooltip: DOMRect, wrapper: DOMRect): TooltipInside => {
  return {
    top: tooltip.top >= wrapper.top,
    left: tooltip.left >= wrapper.left,
    bottom: tooltip.top + tooltip.height <= wrapper.top + wrapper.height,
    right: tooltip.left + tooltip.width <= wrapper.left + wrapper.width,
  };
};

const isInside = (tooltip: DOMRect, wrapper: DOMRect): boolean => {
  const values = calculateIsInside(tooltip, wrapper);
  const outside = Object.keys(values).filter((key) => values[key] === false);
  return outside.length === 0;
};

const directionInfoToDomRect = (direction: DirectionInfo, tooltipContainer: DOMRect): DOMRect => {
  return DOMRectReadOnly.fromRect({
    x: direction.left,
    y: direction.top,
    width: tooltipContainer.width,
    height: tooltipContainer.height,
  });
};

/*
  We want to position the tooltip in the direction that the user specified
  But we also want to make sure the tooltip doesn't go off-screen

  There are 2 possible ways to do this:
  1. We can position the tooltip in the direction that the user specified, then translate it to fit it in the boundary
  2. We can test all possible directions, and if one direction is invalid, we change the direction to the next one

  2 is easier to implement, but we choose Option 1, because it respects the intent of the user and shouldn't have any cases where the tooltip finds zero valid positions
*/

export const getPosition = (
  parent: DOMRect, // the thing that triggers the tooltip
  tooltipContainer: DOMRect,
  direction: TooltipDirection,
  keepTooltipInside?: string, // the div ID of the bounding box
  margin?: number // the amount of space to leave between the tooltip and the parent
): DirectionInfo => {
  const boundary = getTooltipBoundary(keepTooltipInside);
  // position the tooltip at the specified direction
  const bestCoords: DirectionInfo | undefined = getTooltipDirection(direction, parent, tooltipContainer, margin);
  // see if it's inside the boundary
  let bestCoordsAsDR = directionInfoToDomRect(bestCoords, tooltipContainer);
  let tooltipInside = isInside(bestCoordsAsDR, boundary);
  while (!tooltipInside) {
    const boundaryInfo = calculateIsInside(bestCoordsAsDR, boundary);
    const outside = Object.keys(boundaryInfo).filter((key) => boundaryInfo[key] === false);
    for (const dir of outside) {
      switch (dir) {
        case "top":
          bestCoords.top += SHIFT_FACTOR;
          break;
        case "left":
          bestCoords.left += SHIFT_FACTOR;
          break;
        case "right":
          bestCoords.left -= SHIFT_FACTOR;
          break;
        case "bottom":
          bestCoords.top -= SHIFT_FACTOR;
          break;
        default:
          break;
      }
    }
    bestCoordsAsDR = directionInfoToDomRect(bestCoords, tooltipContainer);
    tooltipInside = isInside(bestCoordsAsDR, boundary);
  }
  return bestCoords;
};
