import React from "react";
import styled from "styled-components";

export const IconButton = styled.img<{ active?: boolean }>`
  opacity: ${(p) => (p.active ? 1 : 0.5)};
  cursor: pointer;

  ${(p) => !p.active && ":hover { opacity: 0.8; }"}
  ${(p) => !p.active && ":active { opacity: 1; }"}
`;
