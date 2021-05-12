import React, { useState } from "react";
import { UIManager } from "../UIManager";
import styled from "styled-components";
import { colors } from "../../theme";
import { useEffect } from "react";
import { GAME_UI_CLASSNAME } from "../Utils/Utils";
import { observer } from "mobx-react-lite";
import { useGameManager } from "../Hooks/useGameManager";

export const UpdateWithBlockNumber: React.FC<React.HTMLProps<HTMLDivElement>> = observer(({ children, ...props }) => {
  const gm = useGameManager();
  const [_, setBlockNumber] = useState(0);
  console.log("Block number", _);
  useEffect(() => {
    gm && setBlockNumber(gm.net.blockNumber);
  }, [gm]);
  return <div {...props}>{children}</div>;
});
