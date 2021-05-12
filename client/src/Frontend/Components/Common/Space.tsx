import styled from "styled-components";

export const Space = styled.div<{ w?: string | number; h?: string | number }>`
  ${(p) => (p.w ? "width:" + (typeof p.w === "number" ? p.w + "px" : p.w) : "")};
  ${(p) => (p.h ? "height:" + (typeof p.h === "number" ? p.h + "px" : p.h) : "")};
`;
