import React, { useState } from "react";
import { useEffect } from "react";

const SPEED = 10;

export const AnimatedText: React.FC<{ text: string; onDone?: () => void }> = ({ text, onDone }) => {
  const [typed, setTyped] = useState<string>();
  const [toType, setToType] = useState<string>();

  useEffect(() => {
    setTyped("");
    setToType(text);
  }, [text]);

  useEffect(() => {
    if (toType != null) {
      if (toType !== "") {
        setTimeout(() => {
          const char = toType[0];
          setTyped(typed + char);
          setToType(toType.slice(1));
        }, SPEED);
      } else {
        onDone && onDone();
      }
    }
  }, [toType]);

  return <span>{typed}</span>;
};
