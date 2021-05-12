import React from "react";
import { observer } from "mobx-react-lite";
import styled from "styled-components";
import { InfoModal } from "../../Common/InfoModal";
import { PreferenceInputToggle } from "../../PreferenceInputToggle";
import { PreferenceMuteToggle } from "../../PreferenceMuteToggle";
import { Tooltip, TooltipDirection } from "../../Tooltips";
import { SoundManager } from "../../../../Renderer/manager/SoundManager";

export const Preferences = observer(() => {
  return (
    <InfoModal
      title={""}
      body={
        <Container>
          <ContainerRow>
            <Tooltip
              title="Input Mode"
              text="Toggle between mouse and trackpad input"
              direction={TooltipDirection.Bottom}
              margin={8}
            >
              <PreferenceInputToggle />
            </Tooltip>
            <Tooltip title="Sound" text="Mute / unmute the sound" direction={TooltipDirection.Bottom} margin={8}>
              <PreferenceMuteToggle />
            </Tooltip>
          </ContainerRow>
          <ContainerRow>
            <input
              type="range"
              min={0}
              max={100}
              value={SoundManager.instance.volume * 100 || 0}
              onChange={(event) => {
                SoundManager.instance?.setVolume(parseFloat(event.target.value) / 100);
              }}
            />
          </ContainerRow>
        </Container>
      }
    />
  );
});

const ContainerRow = styled.div`
  margin-top: 5px;
  margin-bottom: 5px;
  display: grid;
  grid-auto-flow: column;
  justify-content: space-between;
  grid-gap: 20px;
`;

const Container = styled.div`
  display: grid;
  grid-auto-flow: row;
  grid-gap: 5px;
`;
