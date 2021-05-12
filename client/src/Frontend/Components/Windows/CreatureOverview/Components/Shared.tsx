import styled from "styled-components";
import { Text } from "../../../Common/Text";
import { colors } from "../../../../../theme";

export const HeadlineRow = styled.div`
  display: grid;
  auto-flow: row;
  align-content: center;
`;

export const Headline = styled(Text)`
  display: block;
  font-size: 13px;
`;
export const Subheadline = styled(Text)`
  display: block;
  color: ${colors.lightgray};
  font-size: 12px;
`;