import { observer } from "mobx-react-lite";
import React, { useState } from "react";
import styled from "styled-components";
import { ICam } from "../../Renderer/manager/CameraState";
import { colors, fonts } from "../../theme";
import { useCameraState } from "../Hooks/useCameraState";
import { useUIState } from "../Hooks/useUIState";
import { UIManager } from "../UIManager";
import { InputMode } from "../../Renderer/manager/InputManager";
import { TooltipDirection, Tooltip } from "./Tooltips";
import { TilemapSlice } from "./TilemapSlice";
import { Spritesheet } from "./Spritesheet";
import { PreferenceInputToggle } from "./PreferenceInputToggle";
import { PreferenceMuteToggle } from "./PreferenceMuteToggle";

export const CameraShortcuts = observer(() => {
  const cameraState = useCameraState();


  const keys = ["Z", "X", "C"];
  const [expanded, setExpanded] = useState<boolean>(false);

  if (!cameraState) return null;
  const { cameras, nActive } = cameraState;

  if (nActive === 0)
    return (
      <Container>
        <Tooltip
          title="Camera Shortcuts"
          text="Save the camera position of a selection with ALT+[Z, X, C] and jump to it later with Z, X, or C. SHIFT recalls your previous position before a jump."
          direction={TooltipDirection.Top}
        >
          <ImgBox onClick={() => setExpanded((prev) => !prev)}>
            <img width={60} src="../../Assets/img/map.png" />
          </ImgBox>
        </Tooltip>
        {expanded && (
          <ExpandedContainer>
            <CamText>No camera groups have been set</CamText>
          </ExpandedContainer>
        )}
      </Container>
    );

  return (
    <Container>
      <Tooltip
        title="Camera Shortcuts"
        text="Save the camera position of a selection with ALT+[Z, X, C] and jump to it later with Z, X, or C. SHIFT recalls your previous position before a jump."
        direction={TooltipDirection.Top}
      >
        <ImgBox onClick={() => setExpanded((prev) => !prev)}>
          <img width={60} src="../../Assets/img/map.png" />
        </ImgBox>
      </Tooltip>
      {expanded && (
        <ExpandedContainer>
          {Object.values(cameras).map((cam: ICam, i: number) => (
            <CamContainer
              inactive={!cam.selection && !cam.creatureId}
              onClick={() => (cam.selection || cam.creatureId ? UIManager.getInstance().jumpToCameraGroup(i) : {})}
            >
              <CamBox key={i} inactive={!cam.selection && !cam.creatureId}>
                {cam.spriteIndex && (
                  <TilemapSlice
                    tileIndex={cam.spriteIndex}
                    tileWidth={24}
                    tileHeight={24}
                    tilemapHeight={768}
                    tilemapWidth={768}
                    imgPath="../../Assets/tilemaps/tilemap.png"
                  />
                )}
                {cam.creatureSprite && <Spritesheet spriteWidth={24} nFrames={4} imgPath={cam.creatureSprite} />}
                <CameraBtn inactive={!cam.selection && !cam.creatureId}>{keys[i]}</CameraBtn>
              </CamBox>
              <CamText>Group {i + 1}</CamText>
            </CamContainer>
          ))}
        </ExpandedContainer>
      )}
    </Container>
  );
});

const CamContainer = styled.div<{ inactive?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-right: 8px;
  cursor: ${(p) => (p.inactive ? "not-allowed" : "pointer")};
  &:last-child {
    margin-right: 0;
  }
`;

const CamText = styled.span`
  color: #fff;
  font-family: ${fonts.regular};
  font-size: 11px;
  font-weight: regular;
`;

const CamBox = styled.div<{ inactive?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  border-radius: 4px;
  width: 100%;
  margin-bottom: 4px;
  position: relative;
  height: 100%;
  background-color: ${(p) => (!p.inactive ? "rgb(35, 31, 38)" : "#494949")};
  overflow: hidden;
`;

const ImgBox = styled.div`
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  box-sizing: border-box;
  align-items: center;
  padding: 8px;
  transition: 0.2s ease-in-out;
`;

const Container = styled.div`
  margin-left: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  position: relative;
  align-items: center;
`;

const ExpandedContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 8px;
  background: rgba(9, 9, 9, 0.8);
  backdrop-filter: blur(4px);
  border-radius: 2px;
  animation: openAnim 0.2s ease;
  @keyframes openAnim {
    0% {
      transform: translate(-50px, 0px);
      opacity: 0%;
    }
    50% {
      transform: translate(0px, 0px);
      opacity: 50%;
    }
    100% {
      transform: translate(0px, 0px);
      opacity: 100%;
    }
  }
`;

const CameraBtn = styled.button<{ inactive: boolean }>`
  font-family: ${fonts.regular};
  color: ${(p) => (p.inactive ? "rgba(255,255,255,0.6)" : colors.white)};
  background-color: ${(p) => (!p.inactive ? colors.txConfirming : "#494949")};
  text-decoration: none;
  border-radius: 4px;
  border: none;
  position: absolute;
  top: 0;
  left: 0;
  transition: 0.2s ease-in-out;
  &:focus {
    outline: 0;
  }
`;
