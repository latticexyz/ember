import styled from "styled-components";
import { colors, fonts } from "../../../theme";

export const Button = styled.button<{ disabled?: boolean }>`
  font-family: ${fonts.regular};
  width: 100%;
  display: flex;
  align-items: center;
  min-height: 24px;
  border: 1px solid #666666;
  box-sizing: border-box;
  border-radius: 4px;
  padding: 6px 8px;
  cursor: ${(p) => (p.disabled ? "not-allowed" : "pointer")};
  transition: 0.1s ease-in-out;
  background-color: #282b33;
  border-bottom: ${(p) => (p.disabled ? "none" : "2px solid #101215")};
  border-top: ${(p) => (p.disabled ? "none" : "2px solid #958d7a")};
  border-left: ${(p) => (p.disabled ? "none" : "2px solid #383b42")};
  border-right: ${(p) => (p.disabled ? "none" : "2px solid #383b42")};
  color: ${(p) => (p.disabled ? colors.greyed : colors.white)};
  transition: 0.2s ease-in-out;
  ${(p) =>
    !p.disabled &&
    `&:hover {
    background: #8a89ca;
    border-bottom: 2px solid #1f244e;
    border-top: 2px solid #d0cfff;
    border-left: 2px solid #313c62;
    border-right: 2px solid #313c62;
  }`}
`;

export const ButtonWrapper = styled.div<{ disabled?: boolean; row?: boolean }>`
display: flex;
width: 100%;
align-items: center:
justify-content: center;
padding: 4px;
margin-top: ${(p) => (p.row ? "0px" : "4px")};
margin-right: ${(p) => (p.row ? "8px" : "0px")};
background: linear-gradient(180deg, #282B33 0%, #1B1D23 100%);
border-radius: 5px;
transition: all .2s ease-in-out;
cursor: ${(p) => (p.disabled ? "not-allowed" : "pointer")};
$${(p) =>
    p.row &&
    `
&:last-child {
  margin-right: 0;
}
`}
${(p) =>
    !p.disabled &&
    `&:hover {
  background: linear-gradient(180deg, #9392CA 0%, #4B4B6C 100%);
  box-shadow: 0px 0px 24px -6px #818DFF;
  .btn-content {
    background: #8a89ca;
    border-bottom: 2px solid #1f244e;
    border-top: 2px solid #d0cfff;
    border-left: 2px solid #313c62;
    border-right: 2px solid #313c62;
  }
}`}
`;

export const PaddedButton = styled(Button)`
  padding: 10px;
`