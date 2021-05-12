import React from "react";
import population from "../../../Assets/img/population.png";

export const Population: React.FC<React.HTMLAttributes<HTMLImageElement>> = (props) => (
  <img {...props} src={population} />
);
