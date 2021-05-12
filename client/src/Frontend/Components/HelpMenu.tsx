import { observer } from "mobx-react-lite";
import { useUIState } from "../Hooks/useUIState";
import React, { useState } from "react";
import styled from "styled-components";
import { Input } from "./Common/Input";
import { fonts } from "../../theme";
import { GameUI } from "./GameUI";
import { HelpContent, IHelpCard } from "./HelpContent";
import { UIManager } from "../UIManager";

const HelpCard: React.FC<IHelpCard> = ({ title, desc }) => {
  return (
    <HelpCardContainer>
      <TextHeader>{title}</TextHeader>
      <Desc>{desc}</Desc>
    </HelpCardContainer>
  );
};

export const HelpMenu = observer(() => {
  const { showHelp } = useUIState();
  const [query, setQuery] = useState<string>("");
  if (!showHelp) return null;

  const filteredCards = !query
    ? HelpContent
    : HelpContent.filter(
        (card) =>
          card.title.toLowerCase().includes(query.toLowerCase()) ||
          card.desc.toLowerCase().includes(query.toLowerCase())
      );
  return (
    <GameUI>
      <Container>
        <Header>
          <Title>Help</Title>
          <CloseButton
            onClick={() => {
              UIManager.getInstance().state.toggleHelp();
              setQuery("");
            }}
          >
            <CloseIcon />
          </CloseButton>
        </Header>
        <SearchContainer>
          <Input placeholder="Search" onChange={(e) => setQuery(e.target.value)} />
        </SearchContainer>
        {filteredCards.map((content: IHelpCard, index: number) => (
          <HelpCard key={index} title={content.title} desc={content.desc} />
        ))}
      </Container>
    </GameUI>
  );
});

const CloseButton = styled.div`
  height: 32px;
  width: 32px;
  border-radius: 4px;
  background-color: #3e3e3e;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: 0.2s ease-in-out;
  &:hover {
    background-color: #505050;
  }
`;

const CloseIcon = () => {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
        fill="currentColor"
        fill-rule="evenodd"
        clip-rule="evenodd"
      ></path>
    </svg>
  );
};

const Container = styled.div`
  background: #000;
  color: #fff;
  border-radius: 4px;
  position: fixed;
  top: 12px;
  bottom: 12px;
  right: 12px;
  display: flex;
  overflow: auto;
  flex-direction: column;
  z-index: 500;
  border-radius: 6px;
  padding: 18px 24px;
  width: 330px;
  max-width: calc(100vw - 24px);
  font-family: ${fonts.regular};
  animation: openAnim 0.2s ease;
  @keyframes openAnim {
    0% {
      transform: translate(50px, 0px);
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
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Title = styled.h2`
  font-weight: 500;
`;

const SearchContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 1rem;
`;

const HelpCardContainer = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  color: #fff;
  background: #3e3e3e;
  padding: 0.5rem;
  margin-bottom: 12px;
  cursor: pointer;
  transition: 0.2s ease-in-out;
  &:hover {
    background: #505050;
  }
`;

const TextHeader = styled.span`
  line-height: normal;
  font-weight: 600;
`;
const Desc = styled.p`
  color: #efefef;
  font-size: 14x;
`;

const Right = styled.div``;
