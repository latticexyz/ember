import React from "react";
import styled from "styled-components";
import { GameUI } from "../GameUI";
import { colors, fonts } from "../../../theme";
import { Text } from "./Text";
import { Button, ButtonWrapper } from "./SkeuomorphicButton";

export interface InfoModalProps {
  actions?: {
    title: string;
    subtitle?: React.ReactChild;
    onClick?: () => void;
  }[];
  title: string;
  body: React.ReactChild;
  padding?: number;
}

export const InfoModal: React.FC<InfoModalProps> = ({ actions, title, body, padding }) => {
  return (
    <Container>
      <Body padding={padding}>
        <Title>{title}</Title>
        {body}
      </Body>
      <ButtonRow>
        {actions?.map(({ title, subtitle, onClick }, index) => (
          <ButtonWrapper disabled={!onClick} row={true}>
            <Button
              className="btn-content"
              key={"action-button-" + index}
              disabled={!onClick}
              onClick={onClick ? onClick : () => {}}
            >
              {title}
              {subtitle}
            </Button>
          </ButtonWrapper>
        ))}
      </ButtonRow>
    </Container>
  );
};

const Container = styled.div`
  background: rgba(17, 22, 34, 0.6);
`;

const Body = styled.div<{ padding?: number }>`
  padding: ${(p) => (p.padding == null ? 15 : p.padding)}px;
`;

const Title = styled(Text)`
  font-weight: bold;
  font-size: 13px;
  margin: 0 0 5px 0;
  display: block;
`;

const ButtonRow = styled.div`
  display: flex;
  width: 100%;
  align-items: center;
  position: sticky;
  bottom: 0;
  padding: 0 8px;
  padding-bottom: 8px;
`;
