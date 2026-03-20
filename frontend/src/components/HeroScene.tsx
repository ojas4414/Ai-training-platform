import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  m,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTime,
  useTransform,
} from 'motion/react';

type HeroSceneProps = {
  reducedMotion: boolean;
};

const FLOAT_EASE = [0.16, 1, 0.3, 1] as const;

export function HeroScene({ reducedMotion }: HeroSceneProps) {
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const pointerX = useMotionValue(50);
  const pointerY = useMotionValue(50);

  const frameRotateX = useSpring(tiltX, { stiffness: 160, damping: 22, mass: 0.85 });
  const frameRotateY = useSpring(tiltY, { stiffness: 160, damping: 22, mass: 0.85 });

  const chipOffsetX = useTransform(frameRotateY, [-10, 10], [16, -16]);
  const chipOffsetY = useTransform(frameRotateX, [-10, 10], [-12, 12]);
  const chipShadowX = useTransform(frameRotateY, [-10, 10], [-28, 28]);
  const chipShadowY = useTransform(frameRotateX, [-10, 10], [24, -24]);
  const spotlight = useMotionTemplate`
    radial-gradient(circle at ${pointerX}% ${pointerY}%, rgba(216, 179, 106, 0.18), transparent 34%)
  `;
  const chipFilter = useMotionTemplate`drop-shadow(${chipShadowX}px ${chipShadowY}px 28px rgba(122, 71, 55, 0.28))`;

  const time = useTime();
  const orbitRotate = useTransform(time, [0, 18000], [0, 360], { clamp: false });
  const orbitRotateReverse = useTransform(() => orbitRotate.get() * -1.35);
  const chipFloat = useTransform(time, [0, 3400, 6800], [0, -7, 0], { clamp: false });
  const chipY = useTransform(() => chipOffsetY.get() + (reducedMotion ? 0 : chipFloat.get()));

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reducedMotion) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = (event.clientX - bounds.left) / bounds.width;
    const localY = (event.clientY - bounds.top) / bounds.height;

    pointerX.set(localX * 100);
    pointerY.set(localY * 100);
    tiltY.set((localX - 0.5) * 14);
    tiltX.set((0.5 - localY) * 12);
  };

  const handlePointerLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
    pointerX.set(50);
    pointerY.set(50);
  };

  return (
    <m.div
      className="hero-visual-shell"
      initial={{
        opacity: 0,
        y: reducedMotion ? 0 : 28,
        scale: reducedMotion ? 1 : 0.97,
        filter: reducedMotion ? 'blur(0px)' : 'blur(16px)',
      }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: reducedMotion ? 0.01 : 1.05, ease: FLOAT_EASE }}
    >
      <div className="hero-visual-frame" onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
        <m.div className="hero-visual-spotlight" style={{ background: spotlight }} />

        <m.div
          className="hero-visual-stage"
          style={reducedMotion ? undefined : { rotateX: frameRotateX, rotateY: frameRotateY, transformPerspective: 1600 }}
        >
          <div className="hero-visual-outline hero-visual-outline-back" />
          <div className="hero-visual-outline hero-visual-outline-front" />

          <m.div className="hero-orbit-ring hero-orbit-ring-outer" style={reducedMotion ? undefined : { rotate: orbitRotate }} />
          <m.div className="hero-orbit-ring hero-orbit-ring-inner" style={reducedMotion ? undefined : { rotate: orbitRotateReverse }} />

          <m.div
            className="hero-floating-chip hero-floating-chip-top"
            animate={reducedMotion ? undefined : { y: [0, -8, 0], x: [0, 6, 0] }}
          transition={reducedMotion ? undefined : { duration: 8.2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          >
            <span className="hero-floating-chip-label">Search</span>
            <span className="hero-floating-chip-value">Optuna</span>
          </m.div>

          <m.div
            className="hero-floating-chip hero-floating-chip-right"
            animate={reducedMotion ? undefined : { y: [0, -10, 0], x: [0, -5, 0] }}
          transition={reducedMotion ? undefined : { duration: 7.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut', delay: 0.6 }}
          >
            <span className="hero-floating-chip-label">Portable</span>
            <span className="hero-floating-chip-value">ONNX + INT8</span>
          </m.div>

          <m.div
            className="hero-floating-chip hero-floating-chip-left"
            animate={reducedMotion ? undefined : { y: [0, 8, 0], x: [0, 5, 0] }}
          transition={reducedMotion ? undefined : { duration: 9.1, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut', delay: 0.3 }}
          >
            <span className="hero-floating-chip-label">Tracked</span>
            <span className="hero-floating-chip-value">MLflow runs</span>
          </m.div>

          <m.div
            className="hero-chip-stack-motion"
            style={reducedMotion ? undefined : { x: chipOffsetX, y: chipY, filter: chipFilter }}
          >
            <div className="hero-chip-stack" aria-hidden="true">
              <div className="hero-chip-layer hero-chip-layer-base" />
              <div className="hero-chip-layer hero-chip-layer-mid" />
              <div className="hero-chip-layer hero-chip-layer-top" />
              <div className="hero-chip-core">
                <span className="hero-chip-core-label">ATP</span>
              </div>
            </div>
          </m.div>

          <div className="hero-visual-note hero-visual-note-top">
            <span className="hero-visual-note-label">Background jobs</span>
            <span className="hero-visual-note-value">Train, analyse, export, HPO</span>
          </div>

          <div className="hero-visual-note hero-visual-note-bottom">
            <span className="hero-visual-note-label">Portable artifacts</span>
            <span className="hero-visual-note-value">ONNX plus quantised deployables</span>
          </div>
        </m.div>

        <m.div
          className="hero-scan-line"
          animate={reducedMotion ? { opacity: [0.24, 0.32, 0.24] } : { x: ['-18%', '104%'], opacity: [0.16, 0.32, 0.16] }}
          transition={{
            duration: reducedMotion ? 6.6 : 7.4,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'linear',
          }}
        />
      </div>
    </m.div>
  );
}
