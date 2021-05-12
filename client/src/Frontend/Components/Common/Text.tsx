import styled from "styled-components";
import { fonts, colors } from "../../../theme";

export const Text = styled.span`
  font-family: ${fonts.regular};
  color: ${(p) => (p.color ? p.color : colors.defaultText)};
  font-size: 12px;
`;
