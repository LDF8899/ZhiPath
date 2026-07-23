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
}

export interface ShowcaseAudioSegment {
  id: string;
  staticSrc?: string;
  duration_sec: number;
}

interface ProjectShowcaseProps {
  scenes: ShowcaseScene[];
  audioSegments?: ShowcaseAudioSegment[];
}

const theme = {
  bg: '#101216',
  panel: '#f8f6ee',
  ink: '#141413',
  muted: '#6a6a64',
  line: '#d7d1c1',
  accent: '#1aa18a',
  accent2: '#e1b84b',
  blue: '#2c6fbb',
  red: '#c75b4b',
};

export const ProjectShowcase: React.FC<ProjectShowcaseProps> = ({
  scenes,
  audioSegments = [],
}) => {
  const { fps } = useVideoConfig();
  const frames = calculateSceneFrames(scenes, audioSegments, fps);

  return (
    <AbsoluteFill style={{ background: theme.bg, overflow: 'hidden' }}>
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
}: {
  scene: ShowcaseScene;
  sceneIndex: number;
  totalScenes: number;
  durationFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 80 } });
  const progress = Math.min(1, frame / Math.max(1, durationFrames));
  const assetMotion = scene.focus || { x: 50, y: 50, scaleStart: 1.02, scaleEnd: 1.08 };
  const assetScale = interpolate(progress, [0, 1], [assetMotion.scaleStart, assetMotion.scaleEnd]);
  const fadeOut = interpolate(frame, [durationFrames - 15, durationFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const isDiagram = scene.assetKind === 'diagram';

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Backdrop sceneIndex={sceneIndex} />

      <div
        style={{
          position: 'absolute',
          inset: 52,
          border: `1px solid rgba(248,246,238,0.2)`,
          background: 'rgba(248,246,238,0.045)',
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
              background: scene.assetKind === 'diagram' ? theme.accent2 : theme.accent,
            }}
          />
          <div>
            <div
              style={{
                color: '#f8f6ee',
                fontFamily: 'Microsoft YaHei, Noto Sans SC, sans-serif',
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 0,
              }}
            >
              {scene.chapter}
            </div>
            <div
              style={{
                color: 'rgba(248,246,238,0.62)',
                fontFamily: 'Consolas, monospace',
                fontSize: 16,
                marginTop: 8,
              }}
            >
              ZhiPath Project Showcase
            </div>
          </div>
        </div>
        <div
          style={{
            color: 'rgba(248,246,238,0.7)',
            fontFamily: 'Consolas, monospace',
            fontSize: 18,
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
        }}
      >
        <section
          style={{
            paddingTop: 36,
            opacity: interpolate(enter, [0, 1], [0, 1]),
            transform: `translateX(${interpolate(enter, [0, 1], [-26, 0])}px)`,
          }}
        >
          <div
            style={{
              color: scene.assetKind === 'diagram' ? theme.accent2 : theme.accent,
              fontFamily: 'Consolas, monospace',
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 18,
            }}
          >
            LIVE DEMO FOCUS
          </div>
          <h1
            style={{
              color: '#f8f6ee',
              fontFamily: 'Microsoft YaHei, Noto Sans SC, sans-serif',
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
                color: 'rgba(248,246,238,0.72)',
                fontFamily: 'Microsoft YaHei, Noto Sans SC, sans-serif',
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
                      border: `1px solid rgba(248,246,238,0.18)`,
                      background: 'rgba(248,246,238,0.07)',
                      padding: '15px 16px',
                      opacity: interpolate(statEnter, [0, 1], [0, 1]),
                      transform: `translateY(${interpolate(statEnter, [0, 1], [18, 0])}px)`,
                    }}
                  >
                    <div
                      style={{
                        color: theme.accent2,
                        fontFamily: 'Consolas, monospace',
                        fontSize: 25,
                        fontWeight: 800,
                      }}
                    >
                      {stat.value}
                    </div>
                    <div
                      style={{
                        color: 'rgba(248,246,238,0.68)',
                        fontFamily: 'Microsoft YaHei, Noto Sans SC, sans-serif',
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
            transform: `translateX(${interpolate(enter, [0, 1], [34, 0])}px)`,
          }}
        >
          <BrowserFrame isDiagram={isDiagram}>
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: theme.panel }}>
              <Img
                src={staticFile(scene.asset)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  transform: `scale(${assetScale})`,
                  transformOrigin: `${assetMotion.x}% ${assetMotion.y}%`,
                }}
              />
            </div>
            {(scene.callouts || []).map((callout, idx) => (
              <Callout
                key={`${callout.text}-${idx}`}
                callout={callout}
                delay={28 + idx * 18}
                accent={idx % 2 === 0 ? theme.accent : theme.accent2}
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
            background: 'rgba(248,246,238,0.14)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress * 100}%`,
              background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`,
            }}
          />
        </div>
        <div
          style={{
            color: 'rgba(248,246,238,0.64)',
            fontFamily: 'Consolas, monospace',
            fontSize: 16,
            textAlign: 'right',
          }}
        >
          product demo / evidence driven learning
        </div>
      </footer>
    </AbsoluteFill>
  );
}

function Backdrop({ sceneIndex }: { sceneIndex: number }) {
  const frame = useCurrentFrame();
  const angle = (sceneIndex % 6) * 12;
  const gridX = interpolate(frame % 240, [0, 240], [0, 80]);

  return (
    <AbsoluteFill
      style={{
        background: `
          linear-gradient(${120 + angle}deg, rgba(26,161,138,0.22), transparent 34%),
          linear-gradient(${32 + angle}deg, rgba(225,184,75,0.16), transparent 38%),
          ${theme.bg}
        `,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(rgba(248,246,238,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(248,246,238,0.07) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
          backgroundPosition: `${gridX}px 0`,
          opacity: 0.35,
        }}
      />
      <AbsoluteFill
        style={{
          background: `
            linear-gradient(90deg, rgba(16,18,22,0.92), transparent 28%, transparent 78%, rgba(16,18,22,0.86)),
            linear-gradient(180deg, rgba(16,18,22,0.78), transparent 30%, rgba(16,18,22,0.92))
          `,
        }}
      />
    </AbsoluteFill>
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
        border: `1px solid rgba(248,246,238,0.32)`,
        background: '#e9e4d6',
        boxShadow: '0 28px 80px rgba(0,0,0,0.42)',
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
          background: '#24262b',
          borderBottom: '1px solid rgba(0,0,0,0.24)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          paddingLeft: 18,
          zIndex: 2,
        }}
      >
        {[theme.red, theme.accent2, theme.accent].map((color) => (
          <span key={color} style={{ width: 12, height: 12, borderRadius: 999, background: color }} />
        ))}
        <div
          style={{
            marginLeft: 18,
            height: 22,
            width: isDiagram ? 390 : 520,
            background: 'rgba(248,246,238,0.13)',
            color: 'rgba(248,246,238,0.64)',
            fontFamily: 'Consolas, monospace',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 14,
          }}
        >
          {isDiagram ? 'zhipath.ai / architecture' : 'zhipath.ai / live-product'}
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
          border: `4px solid ${accent}`,
          background: '#f8f6ee',
          boxShadow: '0 0 0 8px rgba(20,20,19,0.16)',
        }}
      />
      <div
        style={{
          maxWidth: 360,
          padding: '12px 15px',
          background: 'rgba(20,20,19,0.9)',
          color: '#f8f6ee',
          borderLeft: `5px solid ${accent}`,
          fontFamily: 'Microsoft YaHei, Noto Sans SC, sans-serif',
          fontSize: 20,
          lineHeight: 1.35,
          fontWeight: 700,
          boxShadow: '0 12px 28px rgba(0,0,0,0.26)',
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
