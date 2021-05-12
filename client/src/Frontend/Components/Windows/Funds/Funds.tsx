import React from "react";
import styled from "styled-components";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { EthAddress } from "../../../../_types/GlobalTypes";
import { useGameManager } from "../../../Hooks/useGameManager";
import { colors } from "../../../../theme";
import { Input } from "../../Common/Input";
import { InfoModal } from "../../Common/InfoModal";
import { Text } from "../../Common/Text";
import { FundWindow } from "./Components/FundWindow";

export const Funds: React.FC = observer(() => {
  const gm = useGameManager();
  if (!gm) return null;

  return (
    <InfoModal title="Funds" body={<FundWindow />} />
  );
});

