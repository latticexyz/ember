import styled from "styled-components";
import React from "react";
import { useSpring, animated } from "@react-spring/web";
import { SpringValue } from "@react-spring/core";
import { useGameManager } from "../../../../Hooks/useGameManager";
import { observer } from "mobx-react-lite";
import { colors } from "../../../../../theme";

export const ChainTimeUpdate: React.FC = observer(() => {
  const gm = useGameManager()!;
  return <Animator key={gm.net.predictedChainTime + "-" + gm.net.predictedChainTimeLastUpdated} />;
});

const Animator = observer(() => {
  const gm = useGameManager()!;
  const elapsed = Date.now() - gm.net.predictedChainTimeLastUpdated;
  const currentProgress = elapsed / (gm.net.chainTimeResolution * 1000);
  const remainingTime = gm.net.chainTimeResolution * 1000 - elapsed;
  const synced = gm.net.chainTimeAndPredictedChainTimeSynced();
  const props = useSpring({
    from: { progress: currentProgress },
    to: { progress: 1 },
    config: { duration: remainingTime },
  });
  if (!gm) return null;
  return (
    <Container>
      <AnimatedCircularProgress {...props} fresh={gm.net.freshChainTime} synced={synced} />
    </Container>
  );
});

const Container = styled.div`
  padding: 0 3px;
`;

export const AnimatedCircularProgress: React.FC<{ progress: SpringValue<number>; synced: boolean; fresh: boolean }> = ({
  progress,
  synced,
  fresh,
}) => {
  return (
    <Circular>
      <animated.div
        style={{
          position: "absolute",
          zIndex: 6,
          top: "50%",
          left: "50%",
          height: SIZE * 0.8,
          width: SIZE * 0.8,
          margin: `-${SIZE * 0.4}px 0 0 -${SIZE * 0.4}px`,
          background: progress.to((prog) => {
            if (!fresh) {
              return colors.invalid;
            } else if (prog < 0.2 && synced) {
              return colors.valid;
            } else {
              return colors.almostblack;
            }
          }),
          borderRadius: SIZE,
        }}
      ></animated.div>
      <Circle>
        <BarLeft>
          <Progress synced={synced} progress={progress} />
        </BarLeft>
        <BarRight>
          <Progress synced={synced} progress={progress} right />
        </BarRight>
      </Circle>
    </Circular>
  );
};

const SIZE = 6;

const Circular = styled.div`
  height: ${SIZE}px;
  width: ${SIZE}px;
  position: relative;
  transform: scale(1.5) rotate(180deg);
`;

const Circle = styled.div``;
const Bar = styled.div`
  position: absolute;
  height: 100%;
  width: 100%;
  background: ${colors.darkgray};
  border-radius: ${SIZE}px;
  clip: rect(0px, ${SIZE}px, ${SIZE}px, ${SIZE * 0.5}px);
`;
const BarLeft = styled(Bar)``;
const BarRight = styled(Bar)`
  transform: rotate(180deg);
  z-index: 3;
`;

const Progress: React.FC<{ progress: SpringValue<number>; synced: boolean; right?: boolean }> = ({
  progress,
  right,
  synced,
}) => {
  return (
    <animated.div
      style={{
        position: "absolute",
        height: "100%",
        width: "100%",
        borderRadius: SIZE,
        clip: `rect(0px, ${SIZE * 0.5}px, ${SIZE}px, 0px)`,
        background: colors.valid,
        zIndex: right ? 0 : 1,
        transform: progress
          .to((x) => {
            if (x < 0.2 && synced) {
              return 1;
            }
            if (right) {
              return x < 0.5 ? x * 2 : 1;
            } else {
              return x < 0.5 ? 0 : (x - 0.5) * 2;
            }
          })
          .to((x) => `rotate(${Math.min(x * 180, 180)}deg)`),
      }}
    />
  );
};
