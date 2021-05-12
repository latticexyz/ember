import React from "react";
import styled from "styled-components";
import { colors } from "../../../theme";

export const FullScreenContainer = styled.div`
  display: flex;
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 99;
  background-color: ${colors.uiBackground};
  backdrop-filter: blur(6px);
  align-items: center;
  justify-content: center;
`;
