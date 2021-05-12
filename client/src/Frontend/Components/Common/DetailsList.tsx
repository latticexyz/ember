import React, { useMemo } from "react";
import styled from "styled-components";
import { colors, fonts } from "../../../theme";
import { useCallback } from "react";
import { ChainTimeUpdate } from "../Windows/InteractDetails/Components/ChainTimeUpdate";
import { Space } from "./Space";

export enum ItemType {
  Detail = "Detail",
  Headline = "Headline",
  Text = "Text",
}

interface WithChainTimeUpdate {
  withChainTimeUpdate?: boolean;
}

interface Detail extends WithChainTimeUpdate {
  type: ItemType.Detail;
  title: React.ReactChild;
  value: React.ReactChild;
}

interface Headline extends WithChainTimeUpdate {
  type: ItemType.Headline;
  title: string;
}

interface Text extends WithChainTimeUpdate {
  type: ItemType.Text;
  value: string;
}

export type DetailListItem = Detail | Headline | Text;

interface Props {
  details: DetailListItem[];
}

export const DetailsList: React.FC<Props> = ({ details }) => {
  const getItemElement = useCallback((item: DetailListItem, index: number) => {
    const getInnerElement = () => {
      if (item.type === ItemType.Headline) {
        return <DetailHeadline key={"headline-" + index + Math.random()}>{item.title}</DetailHeadline>;
      }

      if (item.type === ItemType.Detail) {
        return (
          <DetailRow key={"detail-row-" + index + Math.random()}>
            <DetailTitle>{item.title}</DetailTitle>
            <Dots>
              <DotsInner />
            </Dots>
            <DetailValue>{item.value}</DetailValue>
          </DetailRow>
        );
      }

      if (item.type === ItemType.Text) {
        return (
          <DetailRow key={"detail-row-" + index + Math.random()}>
            <DetailText>{item.value}</DetailText>
          </DetailRow>
        );
      }
    };
    const element = getInnerElement();
    if (item.withChainTimeUpdate) {
      return (
        <DetailWithChainUpdateRow>
          {element}
          <Space w={5} />
          <ChainTimeUpdate />
        </DetailWithChainUpdateRow>
      );
    } else {
      return element;
    }
  }, []);

  const items = useMemo(() => {
    return details.map(getItemElement);
  }, [details, getItemElement]);

  return <Container>{items}</Container>;
};

const Container = styled.div`
  color: ${colors.white};
  font-family: ${fonts.regular};
  font-size: 13px;
`;

const DetailRow = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
`;

const DetailWithChainUpdateRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
`;

const DetailTitle = styled.div``;

const DetailValue = styled.div``;

const DetailText = styled.div`
  max-width: 300px;
`;

const DotsInner = styled.div`
  position: absolute;
  :before {
    width: 0;
    white-space: nowrap;
    content: "..........................................................................................................................................................................";
  }
`;

const Dots = styled.div`
  overflow-x: hidden;
  position: relative;
  min-width: 30px;
  opacity: 0.3;
`;

const DetailHeadline = styled.div`
  color: ${colors.lightgray};
  font-size: 12px;
  :not(:first-child) {
    margin-top: 10px;
  }
`;

// const Container = styled.ul`
//   padding: 0;
//   list-style: none;
//   overflow-x: hidden;
//   margin: 30px;
// `;

// const DetailRow = styled.li`
//   color: ${colors.white};
//   font-family: ${fonts.regular};

//   :before {
//     float: left;
//     width: 0;
//     white-space: nowrap;
//     content: ". . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . ";
//   }

//   span {
//     float: right;
//   }

//   span:first-child {
//     float: left;
//     padding-right: 20px;
//   }
// `;
//
