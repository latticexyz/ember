import { observer } from "mobx-react-lite";
import React, { useState } from "react";
import styled from "styled-components";
import { useInputManager } from "../Hooks/useInputManager";
import { InputMode } from "../../Renderer/manager/InputManager";

export const PreferenceInputToggle = observer(() => {
    const inputManager = useInputManager();
    const [inputMode, setInputMode] = useState(inputManager.inputMode);

    const toggleInputMode = () => {
        inputManager.inputMode = inputMode === InputMode.TRACKPAD ? InputMode.MOUSE : InputMode.TRACKPAD;
        setInputMode(inputManager.inputMode);

        localStorage.setItem("preference-input-mode", inputManager.inputMode === InputMode.MOUSE ? "mouse" : "trackpad");
    };

    return (
        <div onClick={toggleInputMode}>
            <ImgBox>
                {inputMode === InputMode.TRACKPAD
                    ?
                    <img width={35} src="../../Assets/img/touchpad.png" />
                    :
                    <img width={35} src="../../Assets/img/mouse.png" />
                }
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
