import React from "react";
import mana from "../../../Assets/img/manaSmall.png";

export const Mana: React.FC<React.HTMLAttributes<HTMLImageElement>> = (props) => <img {...props} src={mana} />;
