import { observer } from "mobx-react-lite";
import React from "react";
import styled from "styled-components";
import { SoundManager } from "../../Renderer/manager/SoundManager";

export const PreferenceMuteToggle = observer(() => {
  const toggleSound = () => {
    SoundManager.instance.volume > 0 ? SoundManager.instance.setVolume(0) : SoundManager.instance.setVolume(1);
  };

  return (
    <div onClick={toggleSound}>
      <ImgBox>
        {SoundManager.instance.volume > 0 ? (
          <img width={35} src="../../Assets/img/speaker.png" />
        ) : (
          <img width={35} src="../../Assets/img/speaker-mute.png" />
        )}
      </ImgBox>
    </div>
  );
});

const ImgBox = styled.div`
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  box-sizing: border-box;
  align-items: center;
  padding: 8px;
  transition: 0.2s ease-in-out;
`;
