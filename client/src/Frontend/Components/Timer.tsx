import React, { useState, useRef } from "react";
import { useEffect } from "react";
export const Timer: React.FC<{ start: number }> = ({ start }) => {
  const timeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const time = Date.now() - start;
      const currentTimeRef = timeRef.current;
      if (!currentTimeRef) return;
      currentTimeRef.innerText = String(Math.floor(time / 100));
    }, 100);

    return () => clearInterval(interval);
  }, [start]);

  return <span ref={timeRef}></span>;
};
