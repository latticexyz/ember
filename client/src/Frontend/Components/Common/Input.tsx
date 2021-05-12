import React from "react";
import styled from "styled-components";
import { colors, fonts } from "../../../theme";
import { useUIState } from "../../Hooks/useUIState";

export const Input = ({ placeholder, onChange }) => {
  const ui = useUIState();
  return (
    <PropInput
      placeholder={placeholder}
      onChange={onChange}
      onFocus={() => ui.setInputFocused(true)}
      onBlur={() => ui.setInputFocused(false)}
    />
  );
};

const PropInput = styled.input`
  background: ${colors.verydarkgray};
  border-radius: 3px;
  border: none;
  padding: 8px;
  color: ${colors.white};
  font-family: ${fonts.regular};
  &:focus {
    outline: none;
  }
  ::placeholder {
    font-family: ${fonts.regular};
  }
`;
