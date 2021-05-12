import React from "react";
import coin from "../../../Assets/img/coin.png";

export const Coin: React.FC<React.HTMLAttributes<HTMLImageElement>> = (props) => <img {...props} src={coin} />;
