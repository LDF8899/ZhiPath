import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { MOTION_PRESETS, resolveMotionStyle } from '../motion/presets';
import { motionInterpolate, motionProgress } from '../motion/runtime';
import { showcaseStyleVars } from '../motion/styles';
import type { MotionStyleId, VisualStyleId } from '../motion/types';

type AssetKind = 'screenshot' | 'diagram';

export interface ShowcaseCallout {
  text: string;
  x: number;
  y: number;
}

export interface ShowcaseScene {
  id: string;
  chapter: string;
  title: string;
  subtitle?: string;
  asset: string;
  assetKind: AssetKind;
  narration: string;
  durationSec: number;
  focus?: {
    x: number;
    y: number;
    scaleStart: number;
    scaleEnd: number;
  };
  callouts?: ShowcaseCallout[];
  stats?: Array<{ label: string; value: string }>;
  visualStyle?: VisualStyleId;
  motionStyle?: MotionStyleId;
}

export interface ShowcaseAudioSegment {
  id: string;
  staticSrc?: string;
  duration_sec: number;
}

interface ProjectShowcaseProps {
  scenes: ShowcaseScene[];
  audioSegments?: ShowcaseAudioSegment[];
  projectName?: string;
  footerText?: string;
  visualStyle?: VisualStyleId;
  motionStyle?: MotionStyleId;
}

const theme = {
  bg: 'var(--vv-bg)',
  paper: 'var(--vv-paper)',
  paperTint: 'var(--vv-paper-tint)',
  panel: 'var(--vv-panel)',
  ink: 'var(--vv-ink)',
  pencil: 'var(--vv-pencil)',
  muted: 'var(--vv-muted)',
  line: 'var(--vv-line)',
  grid: 'var(--vv-grid)',
  accent: 'var(--vv-accent)',
  accent2: 'var(--vv-accent-2)',
  highlight: 'var(--vv-highlight)',
  blue: 'var(--vv-blue)',
  green: 'var(--vv-green)',
  red: 'var(--vv-red)',
};

const font = {
  body: 'var(--vv-font-body)',
  display: 'var(--vv-font-display)',
  mono: 'var(--vv-font-mono)',
};

export const ProjectShowcase: React.FC<ProjectShowcaseProps> = ({
  scenes,
  audioSegments = [],
  projectName = 'Vibing Video',
  footerText = 'generated video / material driven story',
  visualStyle = 'editorial-paper',
  motionStyle,
}) => {
  const { fps } = useVideoConfig();
  const frames = calculateSceneFrames(scenes, audioSegments, fps);

  return (
    <AbsoluteFill style={{ ...showcaseStyleVars(visualStyle), background: theme.bg, overflow: 'hidden' }}>
      {scenes.map((scene, index) => {
        const sf = frames[index];
        if (!sf) return null;
        const audio = audioSegments.find((item) => item.id === scene.id);

        return (
          <Sequence key={scene.id} from={sf.startFrame} durationInFrames={sf.durationFrames}>
            <SceneView
              scene={scene}
              sceneIndex={index}
              totalScenes={scenes.length}
              durationFrames={sf.durationFrames}
              projectName={projectName}
              footerText={footerText}
              visualStyle={scene.visualStyle || visualStyle}
              motionStyle={scene.motionStyle || motionStyle}
            />
            {audio?.staticSrc && <Audio src={staticFile(audio.staticSrc)} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

function SceneView({
  scene,
  sceneIndex,
  totalScenes,
  durationFrames,
  projectName,
  footerText,
  visualStyle,
  motionStyle,
}: {
  scene: ShowcaseScene;
  sceneIndex: number;
  totalScenes: number;
  durationFrames: number;
  projectName: string;
  footerText: string;
  visualStyle: VisualStyleId;
  motionStyle?: MotionStyleId;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const resolvedMotionStyle = resolveMotionStyle(visualStyle, motionStyle);
  const motion = MOTION_PRESETS[resolvedMotionStyle];
  const styleVars = showcaseStyleVars(visualStyle);
  const introEnd = Math.max(1, Math.round(durationFrames * motion.introPortion));
  const outroStart = Math.max(introEnd, Math.round(durationFrames * (1 - motion.outroPortion)));
  const enter = motionProgress(frame, 0, introEnd, motion.enterEase);
  const progress = motionProgress(frame, 0, Math.max(1, durationFrames - 1), motion.cameraEase);
  const assetMotion = scene.focus || { x: 50, y: 50, scaleStart: 1.02, scaleEnd: 1.08 };
  const shotVariant = sceneIndex % 4;
  const cameraTravel = motionInterpolate(shotVariant % 2 === 0 ? -motion.cameraTravel : motion.cameraTravel, shotVariant % 2 === 0 ? motion.cameraTravel : -motion.cameraTravel, progress);
  const cameraLift = motionInterpolate(shotVariant < 2 ? motion.cameraLift * 0.8 : -motion.cameraLift, shotVariant < 2 ? -motion.cameraLift : motion.cameraLift, progress);
  const assetScale = motionInterpolate(assetMotion.scaleStart, assetMotion.scaleEnd + motion.cameraScaleBoost, progress);
  const assetPanX = interpolate(progress, [0, 1], [(50 - assetMotion.x) * 0.18, (assetMotion.x - 50) * 0.18]);
  const assetPanY = interpolate(progress, [0, 1], [(50 - assetMotion.y) * 0.12, (assetMotion.y - 50) * 0.12]);
  const punchIn = interpolate(frame, [0, 18, durationFrames - 24, durationFrames], [0.965, 1, 1, 1.025], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleReveal = motionProgress(frame, Math.min(6, introEnd), introEnd, motion.enterEase);
  const fadeOut = 1 - motionProgress(frame, outroStart, durationFrames, motion.exitEase);
  const isDiagram = scene.assetKind === 'diagram';

  return (
    <AbsoluteFill style={{ ...styleVars, opacity: fadeOut }}>
      <Backdrop sceneIndex={sceneIndex} />
      <SceneEnergy sceneIndex={sceneIndex} durationFrames={durationFrames} energy={motion.energy} />
      <SceneWipe sceneIndex={sceneIndex} durationFrames={durationFrames} skew={motion.wipeSkew} />

      <div
        style={{
          position: 'absolute',
          inset: 52,
          border: `3px solid ${theme.ink}`,
          borderRadius: 18,
          background: 'color-mix(in srgb, var(--vv-panel) 42%, transparent)',
          boxShadow: '8px 10px 0 rgba(var(--vv-ink-rgb), 0.14)',
        }}
      />

      <header
        style={{
          position: 'absolute',
          left: 84,
          right: 84,
          top: 50,
          height: 94,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: interpolate(enter, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(enter, [0, 1], [-18, 0])}px)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 10,
              height: 58,
              border: `2px solid ${theme.ink}`,
              borderRadius: 8,
              background: scene.assetKind === 'diagram' ? theme.accent2 : theme.accent,
              transform: 'rotate(-2deg)',
            }}
          />
          <div>
            <div
              style={{
              color: theme.ink,
              fontFamily: font.display,
              fontSize: 27,
              fontWeight: 800,
              letterSpacing: 0,
              clipPath: `inset(0 ${100 - titleReveal * 100}% 0 0)`,
            }}
          >
            {scene.chapter}
            </div>
            <div
              style={{
                color: theme.pencil,
                fontFamily: font.mono,
                fontSize: 16,
                marginTop: 8,
              }}
            >
              {projectName}
            </div>
          </div>
        </div>
        <div
          style={{
            color: theme.pencil,
            fontFamily: font.mono,
            fontSize: 18,
            border: `1.5px dashed ${theme.pencil}`,
            padding: '8px 12px',
            borderRadius: 8,
            background: theme.paperTint,
            transform: 'rotate(1deg)',
          }}
        >
          {String(sceneIndex + 1).padStart(2, '0')} / {String(totalScenes).padStart(2, '0')}
        </div>
      </header>

      <main
        style={{
          position: 'absolute',
          left: 84,
          right: 84,
          top: 166,
          bottom: 104,
          display: 'grid',
          gridTemplateColumns: isDiagram ? '620px 1fr' : '520px 1fr',
          gap: 34,
          transform: `scale(${punchIn}) translate(${cameraTravel * 0.12}px, ${cameraLift * 0.1}px)`,
        }}
      >
        <section
          style={{
            paddingTop: 36,
            opacity: interpolate(enter, [0, 1], [0, 1]),
            transform: `translateX(${interpolate(enter, [0, 1], [-36, 0])}px) translateY(${cameraLift * 0.45}px)`,
          }}
        >
          <div
            style={{
              color: scene.assetKind === 'diagram' ? theme.blue : theme.accent,
              fontFamily: font.mono,
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 18,
              border: `1.5px dashed ${scene.assetKind === 'diagram' ? theme.blue : theme.accent}`,
              display: 'inline-flex',
              padding: '8px 12px',
              transform: 'rotate(-1deg)',
            }}
          >
            LIVE DEMO FOCUS
          </div>
          <h1
            style={{
              color: theme.ink,
              fontFamily: font.display,
              fontSize: isDiagram ? 50 : 56,
              lineHeight: 1.12,
              fontWeight: 800,
              margin: 0,
              letterSpacing: 0,
            }}
          >
            {scene.title}
          </h1>
          {scene.subtitle && (
            <p
              style={{
                color: theme.pencil,
                fontFamily: font.body,
                fontSize: 25,
                lineHeight: 1.5,
                margin: '24px 0 0',
              }}
            >
              {scene.subtitle}
            </p>
          )}

          {scene.stats && scene.stats.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 12,
                marginTop: 34,
              }}
            >
              {scene.stats.map((stat, idx) => {
                const statEnter = spring({
                  frame: frame - 8 - idx * 5,
                  fps,
                  config: { damping: 18, stiffness: 120 },
                });
                return (
                  <div
                    key={`${stat.label}-${stat.value}`}
                    style={{
                      position: 'relative',
                      border: `2px solid ${theme.pencil}`,
                      borderRadius: 10,
                      background: idx % 2 === 0 ? theme.paperTint : 'color-mix(in srgb, var(--vv-paper-tint) 72%, var(--vv-highlight))',
                      padding: '15px 16px',
                      opacity: interpolate(statEnter, [0, 1], [0, 1]),
                      transform: `translateY(${interpolate(statEnter, [0, 1], [22, 0])}px) scale(${interpolate(statEnter, [0, 1], [0.94, 1])})`,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(110deg, transparent, rgba(var(--vv-highlight-rgb), 0.45), transparent)',
                        transform: `translateX(${interpolate(frame - idx * 8, [20, 60], [-140, 160], {
                          extrapolateLeft: 'clamp',
                          extrapolateRight: 'clamp',
                        })}%)`,
                      }}
                    />
                    <div
                      style={{
                        color: idx % 2 === 0 ? theme.accent : theme.blue,
                        fontFamily: font.display,
                        fontSize: 25,
                        fontWeight: 800,
                      }}
                    >
                      {stat.value}
                    </div>
                    <div
                      style={{
                        color: theme.pencil,
                        fontFamily: font.body,
                        fontSize: 15,
                        marginTop: 6,
                      }}
                    >
                      {stat.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section
          style={{
            position: 'relative',
            minWidth: 0,
            opacity: interpolate(enter, [0, 1], [0, 1]),
            perspective: 1400,
            transform: `
              translateX(${interpolate(enter, [0, 1], [54, 0])}px)
              translateY(${cameraLift}px)
              rotateY(${interpolate(enter, [0, 1], [shotVariant % 2 === 0 ? -7 : 7, shotVariant % 2 === 0 ? 1.6 : -1.6])}deg)
              rotateZ(${interpolate(progress, [0, 1], [shotVariant % 2 === 0 ? -motion.tilt : motion.tilt, shotVariant % 2 === 0 ? motion.tilt : -motion.tilt])}deg)
            `,
          }}
        >
          <BrowserFrame isDiagram={isDiagram}>
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: theme.panel }}>
              {scene.asset === '__placeholder__' ? (
                <PlaceholderVisual
                  scale={assetScale}
                  transformOrigin={`${assetMotion.x}% ${assetMotion.y}%`}
                  translateX={assetPanX}
                  translateY={assetPanY}
                />
              ) : (
                <Img
                  src={staticFile(scene.asset)}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    transform: `translate(${assetPanX}px, ${assetPanY}px) scale(${assetScale})`,
                    transformOrigin: `${assetMotion.x}% ${assetMotion.y}%`,
                  }}
                />
              )}
            </div>
            <ShotOverlay
              focusX={assetMotion.x}
              focusY={assetMotion.y}
              sceneIndex={sceneIndex}
              durationFrames={durationFrames}
              accent={isDiagram ? theme.blue : theme.accent}
            />
            {(scene.callouts || []).map((callout, idx) => (
              <Callout
                key={`${callout.text}-${idx}`}
                callout={callout}
                delay={28 + idx * 18}
                accent={idx % 2 === 0 ? theme.accent : theme.blue}
              />
            ))}
          </BrowserFrame>
        </section>
      </main>

      <footer
        style={{
          position: 'absolute',
          left: 84,
          right: 84,
          bottom: 42,
          height: 38,
          display: 'grid',
          gridTemplateColumns: '1fr 260px',
          gap: 24,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            height: 5,
            background: theme.line,
            border: `1.5px solid ${theme.pencil}`,
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress * 100}%`,
              background: `linear-gradient(90deg, ${theme.accent}, ${theme.blue}, ${theme.accent2})`,
            }}
          />
        </div>
        <div
          style={{
            color: theme.pencil,
            fontFamily: font.mono,
            fontSize: 16,
            textAlign: 'right',
          }}
        >
          {footerText}
        </div>
      </footer>
    </AbsoluteFill>
  );
}

function Backdrop({ sceneIndex }: { sceneIndex: number }) {
  const frame = useCurrentFrame();
  const angle = (sceneIndex % 6) * 12;
  const gridX = interpolate(frame % 240, [0, 240], [0, 24]);

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(circle, rgba(var(--vv-ink-rgb), 0.045) 1px, transparent 1.4px) 0 0 / 22px 22px,
          linear-gradient(${120 + angle}deg, rgba(var(--vv-accent-rgb), 0.08), transparent 34%),
          linear-gradient(${32 + angle}deg, rgba(var(--vv-highlight-rgb), 0.18), transparent 38%),
          ${theme.bg}
        `,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, ${theme.grid} 0 1px, transparent 1px 24px),
            repeating-linear-gradient(90deg, ${theme.grid} 0 1px, transparent 1px 24px)
          `,
          backgroundSize: '24px 24px',
          backgroundPosition: `${gridX}px 0`,
          opacity: 0.42,
        }}
      />
      <AbsoluteFill
        style={{
          background: `
            linear-gradient(90deg, color-mix(in srgb, var(--vv-bg) 94%, transparent), transparent 30%, transparent 78%, color-mix(in srgb, var(--vv-bg) 86%, transparent)),
            linear-gradient(180deg, color-mix(in srgb, var(--vv-bg) 74%, transparent), transparent 38%, color-mix(in srgb, var(--vv-paper-tint) 92%, transparent))
          `,
        }}
      />
    </AbsoluteFill>
  );
}

function SceneEnergy({ sceneIndex, durationFrames, energy }: { sceneIndex: number; durationFrames: number; energy: number }) {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame % 150, [0, 150], [-24, 124]);
  const outro = interpolate(frame, [durationFrames - 24, durationFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity: outro * energy, pointerEvents: 'none' }}>
      {Array.from({ length: 5 }).map((_, idx) => {
        const top = 16 + idx * 17 + ((sceneIndex * 9) % 12);
        const delay = idx * 10;
        const x = interpolate((frame + delay * 3) % 180, [0, 180], [-22, 122]);
        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${top}%`,
              width: idx % 2 === 0 ? 230 : 150,
              height: 2,
              background: `repeating-linear-gradient(90deg, ${idx % 2 === 0 ? theme.accent : theme.blue} 0 10px, transparent 10px 18px)`,
              opacity: 0.2,
              transform: `rotate(${sceneIndex % 2 === 0 ? -12 : 12}deg)`,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(100deg, transparent ${sweep - 10}%, rgba(var(--vv-highlight-rgb), 0.24) ${sweep}%, transparent ${sweep + 10}%)`,
          mixBlendMode: 'multiply',
        }}
      />
    </AbsoluteFill>
  );
}

function SceneWipe({ sceneIndex, durationFrames, skew }: { sceneIndex: number; durationFrames: number; skew: number }) {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const outro = interpolate(frame, [durationFrames - 16, durationFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const color = sceneIndex % 2 === 0 ? theme.accent : theme.highlight;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 20 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: color,
          transform: `translateX(${interpolate(intro, [0, 1], [0, 104])}%) skewX(${-skew}deg)`,
          transformOrigin: 'left center',
          opacity: 0.92,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: theme.paper,
          transform: `translateX(${interpolate(outro, [0, 1], [-104, 0])}%) skewX(${-skew}deg)`,
          transformOrigin: 'right center',
          opacity: 0.9,
        }}
      />
    </AbsoluteFill>
  );
}

function ShotOverlay({
  focusX,
  focusY,
  sceneIndex,
  durationFrames,
  accent,
}: {
  focusX: number;
  focusY: number;
  sceneIndex: number;
  durationFrames: number;
  accent: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const focus = spring({ frame: frame - 24, fps, config: { damping: 16, stiffness: 90 } });
  const scan = interpolate(frame % 120, [0, 120], [-12, 112]);
  const pulse = 0.62 + Math.sin(frame / 8 + sceneIndex) * 0.12;
  const outro = interpolate(frame, [durationFrames - 20, durationFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 3, opacity: outro }}>
      <div
        style={{
          position: 'absolute',
          left: `${focusX}%`,
          top: `${focusY}%`,
          width: 190,
          height: 112,
          border: `3px dashed ${accent}`,
          borderRadius: 8,
          boxShadow: '0 0 0 999px rgba(var(--vv-ink-rgb), 0.04), 4px 5px 0 rgba(var(--vv-ink-rgb), 0.22)',
          transform: `translate(-50%, -50%) scale(${interpolate(focus, [0, 1], [1.35, 1])})`,
          opacity: interpolate(focus, [0, 1], [0, pulse]),
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${focusX}%`,
          top: `${focusY}%`,
          width: 26,
          height: 26,
          borderRadius: 999,
          border: `3px solid ${accent}`,
          transform: 'translate(-50%, -50%)',
          opacity: interpolate(focus, [0, 1], [0, 0.95]),
          background: theme.highlight,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${scan}%`,
          height: 84,
          background: `linear-gradient(180deg, transparent, ${accent}22, transparent)`,
          mixBlendMode: 'multiply',
        }}
      />
    </AbsoluteFill>
  );
}

function PlaceholderVisual({
  scale,
  transformOrigin,
  translateX,
  translateY,
}: {
  scale: number;
  transformOrigin: string;
  translateX: number;
  translateY: number;
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: `
          repeating-linear-gradient(0deg, ${theme.grid} 0 1px, transparent 1px 24px),
          repeating-linear-gradient(90deg, ${theme.grid} 0 1px, transparent 1px 24px),
          ${theme.paperTint}
        `,
        color: theme.ink,
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
        transformOrigin,
        display: 'grid',
        placeItems: 'center',
        fontFamily: font.body,
      }}
    >
      <div
        style={{
          width: '72%',
          border: `4px solid ${theme.ink}`,
          borderRadius: 16,
          padding: 52,
          background: theme.paper,
          boxShadow: '8px 9px 0 rgba(var(--vv-ink-rgb), 0.18)',
          transform: 'rotate(-1deg)',
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 900, marginBottom: 22, fontFamily: font.display, color: theme.accent }}>
          ZhiPath
        </div>
        <div style={{ fontSize: 30, color: theme.pencil, lineHeight: 1.5 }}>
          No material folder selected. The storyboard is generated from your prompt.
        </div>
        <div style={{ marginTop: 40, height: 18, width: '86%', background: theme.highlight, border: `1.5px solid ${theme.ink}` }} />
        <div style={{ marginTop: 18, height: 18, width: '64%', background: 'color-mix(in srgb, var(--vv-accent) 28%, var(--vv-paper))', border: `1.5px solid ${theme.ink}` }} />
        <div style={{ marginTop: 18, height: 18, width: '76%', background: 'color-mix(in srgb, var(--vv-green) 28%, var(--vv-paper))', border: `1.5px solid ${theme.ink}` }} />
      </div>
    </div>
  );
}

function BrowserFrame({
  children,
  isDiagram,
}: {
  children: React.ReactNode;
  isDiagram: boolean;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        border: `3px solid ${theme.ink}`,
        borderRadius: 16,
        background: theme.paperTint,
        boxShadow: '10px 12px 0 rgba(var(--vv-ink-rgb), 0.18)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 44,
          background: theme.paper,
          borderBottom: `3px solid ${theme.ink}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          paddingLeft: 18,
          zIndex: 2,
        }}
      >
        {[theme.red, theme.highlight, theme.green].map((color) => (
          <span key={color} style={{ width: 12, height: 12, borderRadius: 999, background: color, border: `1.5px solid ${theme.ink}` }} />
        ))}
        <div
          style={{
            marginLeft: 18,
            height: 22,
            width: isDiagram ? 390 : 520,
            background: theme.paperTint,
            color: theme.pencil,
            fontFamily: font.mono,
            fontSize: 12,
            border: `1.5px solid ${theme.pencil}`,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 14,
          }}
        >
          {isDiagram ? 'vibing.video / architecture' : 'vibing.video / materials'}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 44, bottom: 0 }}>{children}</div>
    </div>
  );
}

function Callout({
  callout,
  delay,
  accent,
}: {
  callout: ShowcaseCallout;
  delay: number;
  accent: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 110 } });

  return (
    <div
      style={{
        position: 'absolute',
        left: `${callout.x}%`,
        top: `${callout.y}%`,
        transform: `translate(-50%, -50%) scale(${interpolate(enter, [0, 1], [0.92, 1])})`,
        opacity: interpolate(enter, [0, 1], [0, 1]),
        zIndex: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          border: `3px solid ${theme.ink}`,
          background: accent,
          boxShadow: '3px 4px 0 rgba(var(--vv-ink-rgb), 0.18)',
        }}
      />
      <div
        style={{
          maxWidth: 360,
          padding: '13px 16px',
          background: accent === theme.accent ? 'color-mix(in srgb, var(--vv-accent) 28%, var(--vv-paper))' : theme.highlight,
          color: theme.ink,
          border: `2.5px solid ${theme.ink}`,
          borderRadius: 10,
          fontFamily: font.body,
          fontSize: 20,
          lineHeight: 1.35,
          fontWeight: 700,
          boxShadow: '4px 5px 0 rgba(var(--vv-ink-rgb), 0.2)',
          transform: `rotate(${accent === theme.accent ? -1.4 : 1.2}deg)`,
        }}
      >
        {callout.text}
      </div>
    </div>
  );
}

export function calculateSceneFrames(
  scenes: ShowcaseScene[],
  audioSegments: ShowcaseAudioSegment[],
  fps: number,
) {
  const result: Array<{ startFrame: number; durationFrames: number }> = [];
  let cursor = 0;

  for (const scene of scenes) {
    const audio = audioSegments.find((item) => item.id === scene.id);
    const durationSec = audio?.duration_sec || scene.durationSec;
    const durationFrames = Math.max(1, Math.round(durationSec * fps));
    result.push({ startFrame: cursor, durationFrames });
    cursor += durationFrames;
  }

  return result;
}
