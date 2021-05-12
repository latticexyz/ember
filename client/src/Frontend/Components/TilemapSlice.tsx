import React from "react";
import styled from "styled-components";

interface Props {
  tileWidth: number;
  imgPath: string;
  tileIndex: number;
  tilemapHeight: number;
  tilemapWidth: number;
  tileHeight?: number;
  scale?: number;
}

function calculateTilePosition(
  tileIndex: number,
  tileWidth: number,
  tilemapWidth: number,
  tilemapHeight: number,
  tileHeight?: number
) {
  const nTilesWidth = Math.floor(tilemapWidth / tileWidth);
  const tHeight = tileHeight ? tileHeight : tileWidth;
  const nTilesHeight = Math.floor(tilemapHeight / tHeight);
  const translateX = Math.floor(tileIndex % nTilesWidth);
  const translateY = Math.floor(tileIndex / nTilesHeight);
  return { x: translateX, y: translateY };
}

export const TilemapSlice: React.FC<Props> = ({
  tileIndex,
  tileWidth,
  imgPath,
  tilemapHeight,
  tilemapWidth,
  tileHeight,
  scale,
}) => {
  return (
    <Tile
      tileHeight={tileHeight}
      tileWidth={tileWidth}
      imgPath={imgPath}
      scale={scale}
      translateX={calculateTilePosition(tileIndex, tileWidth, tilemapWidth, tilemapHeight, tileHeight).x}
      translateY={calculateTilePosition(tileIndex, tileWidth, tilemapWidth, tilemapHeight, tileHeight).y}
    />
  );
};

const Tile = styled.div<{
  tileWidth: number;
  imgPath: string;
  translateX: number;
  translateY: number;
  tileHeight?: number;
  scale?: number;
}>`
  box-sizing: border-box;
  height: ${(p) => p.tileHeight || p.tileWidth}px;
  width: ${(p) => p.tileWidth}px;
  transform: scale(${(p) => (p.scale ? p.scale : 2)});
  background-repeat: no-repeat;
  image-rendering: pixelated;
  background: url(${(p) => p.imgPath});
  background-origin: content-box;
  background-position: ${(p) => -p.translateX * p.tileWidth}px
    ${(p) => -p.translateY * (p.tileHeight ? p.tileHeight : p.tileWidth)}px;
`;
