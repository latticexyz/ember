import React from "react";
import styled from "styled-components";
import { Text } from "./Common/Text";

const Container = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;
export const FPSMeter: React.FC = () => {
  return (
    <Container>
      <Text id="fpsCount">FPS:</Text>
    </Container>
  );
};
