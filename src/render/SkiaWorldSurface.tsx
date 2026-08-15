import {
  Atlas,
  Canvas,
  Circle,
  FilterMode,
  Group,
  Line,
  MipmapMode,
  Oval,
  RoundedRect,
  Skia,
  rect,
  vec,
} from '@shopify/react-native-skia';
import { useImage } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { tileFootPoint } from '../world/movement/motion-clock';
import { AtmosphereOverlay } from './AtmosphereOverlay';
import { DistrictLightingOverlay } from './DistrictLightingOverlay';
import { bottomPivotTransform } from './protagonist-wobble';
import { worldToScreen, type CameraState, type ViewportSize } from './camera';
import { ProceduralMapEffects } from './vfx/ProceduralMapEffects';
import type { AtlasRectangle } from './atlas';
import type {
  WorldCharacterPlacement,
  WorldFrameState,
  WorldLayer,
  WorldPropPlacement,
} from './world-frame';

const atlasImage = require('../../assets/generated/world-atlas.png') as number;
const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;
const TILE_SIZE = 32;

type GroundedVisual = Readonly<{ id: string; kind: 'prop' | 'character'; placement: unknown }>;

function atlasData(placements: readonly Readonly<{
  scale: number;
  source: AtlasRectangle;
  worldX: number;
  worldY: number;
}>[], zoom: number) {
  return {
    sprites: placements.map(({ source }) => rect(source.x, source.y, source.width, source.height)),
    transforms: placements.map(({ scale, worldX, worldY }) => {
      return Skia.RSXform(zoom * scale, 0, worldX * zoom, worldY * zoom);
    }),
  };
}

function characterAtlasData(placements: readonly WorldCharacterPlacement[], zoom: number) {
  return {
    sprites: placements.map(({ source }) => rect(source.x, source.y, source.width, source.height)),
    transforms: placements.map(({ worldX, worldY, angleDegrees = 0 }) => {
      if (angleDegrees === 0) return Skia.RSXform(zoom, 0, worldX * zoom, worldY * zoom);
      const transform = bottomPivotTransform({ worldX, worldY, zoom, angleDegrees });
      return Skia.RSXform(transform.scos, transform.ssin, transform.tx, transform.ty);
    }),
  };
}

/**
 * Stage 5: every Skia drawing surface for the world, behind one lazy boundary.
 *
 * WorldScene imported Skia at module scope, so the Skia module body evaluated against an absent
 * global.CanvasKit on the Three.js path and crashed with an undefined XYWHRect. Keeping all Skia
 * here lets WorldScene stay renderer-neutral and lets the default path skip CanvasKit entirely.
 * Stage 7 deletes this file with the rest of Skia.
 */
export function SkiaWorldSurface({
  camera,
  groundBatches,
  onReady,
  reducedMotion,
  surface,
  vfxCamera,
  vfxMode,
  worldFrame,
}: Readonly<{
  camera: CameraState;
  groundBatches: readonly (readonly GroundedVisual[])[];
  onReady: () => void;
  reducedMotion: boolean;
  surface: ViewportSize;
  vfxCamera: Readonly<{ x: number; y: number; zoom: number; dpr: number }>;
  vfxMode: 'procedural' | 'circle';
  worldFrame: WorldFrameState;
}>) {
  const image = useImage(atlasImage);

  // The Skia path reports world readiness once the atlas has decoded and the canvas has painted.
  // A large surface needs more than two frames before CanvasKit has filled it, and reporting too
  // early let the packaged smoke capture backdrop instead of world content at 2530x1410.
  useEffect(() => {
    if (!image) return undefined;
    let frame = 0;
    let remaining = 6;
    const step = (): void => {
      remaining -= 1;
      if (remaining <= 0) onReady();
      else frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [image, onReady]);
  const lighting = worldFrame.lighting;
  const shelterCells = worldFrame.shelterCells;
  const floorAtlas = useMemo(() => atlasData(worldFrame.floors, camera.zoom), [camera.zoom, worldFrame.floors]);
  const groundDetailAtlas = useMemo(() => atlasData(worldFrame.groundDetails, camera.zoom), [camera.zoom, worldFrame.groundDetails]);
  const wallAtlas = useMemo(() => atlasData(worldFrame.walls, camera.zoom), [camera.zoom, worldFrame.walls]);
  const roofAtlas = useMemo(() => atlasData(worldFrame.roofs, camera.zoom), [camera.zoom, worldFrame.roofs]);
  const atlasCameraTransform = useMemo(() => [
    { translateX: -camera.x * camera.zoom },
    { translateY: -camera.y * camera.zoom },
  ], [camera.x, camera.y, camera.zoom]);
  const selectedScreen = worldToScreen(camera, {
    x: worldFrame.selectionRing.worldX,
    y: worldFrame.selectionRing.worldY,
  });
  const feedbackScreen = worldFrame.failureMarker
    ? worldToScreen(camera, { x: worldFrame.failureMarker.worldX, y: worldFrame.failureMarker.worldY })
    : undefined;

  const renderLayer = (layer: WorldLayer) => {
    switch (layer) {
      case 'floor':
        return (
          <Group key={layer} transform={atlasCameraTransform}>
            <Atlas image={image} sampling={NEAREST} sprites={floorAtlas.sprites} transforms={floorAtlas.transforms} />
            {worldFrame.groundDetails.length > 0 ? (
              <Atlas image={image} sampling={NEAREST} sprites={groundDetailAtlas.sprites} transforms={groundDetailAtlas.transforms} />
            ) : null}
            {worldFrame.doorWear.map((door) => {
              const horizontal = door.horizontal;
              return (
                <Group key={`door-wear-${door.id}`}>
                  <Line color={door.darkColor} p1={vec((door.worldX + (horizontal ? 5 : 24)) * camera.zoom, (door.worldY + (horizontal ? 29 : 6)) * camera.zoom)} p2={vec((door.worldX + (horizontal ? 15 : 27)) * camera.zoom, (door.worldY + (horizontal ? 31 : 16)) * camera.zoom)} strokeCap="round" strokeWidth={2 * camera.zoom} />
                  <Line color={door.lightColor} p1={vec((door.worldX + (horizontal ? 17 : 27)) * camera.zoom, (door.worldY + (horizontal ? 28 : 18)) * camera.zoom)} p2={vec((door.worldX + (horizontal ? 25 : 25)) * camera.zoom, (door.worldY + (horizontal ? 30 : 26)) * camera.zoom)} strokeCap="round" strokeWidth={camera.zoom} />
                </Group>
              );
            })}
          </Group>
        );
      case 'prop':
        return (
          <Group key={layer} transform={atlasCameraTransform}>
            {(() => {
              const doors = atlasData(worldFrame.doors, camera.zoom);
              return <Atlas image={image} sampling={NEAREST} sprites={doors.sprites} transforms={doors.transforms} />;
            })()}
          </Group>
        );
      case 'shadow':
        return (
          <Group key={layer} transform={atlasCameraTransform}>
            {worldFrame.propShadows.map((shadow) => (
              <Group key={`prop-shadow-${shadow.id}`}>
                {shadow.long ? (
                  <Line
                    color={lighting.shadow.color}
                    p1={vec((shadow.worldX + shadow.width / 2) * camera.zoom, shadow.worldY * camera.zoom)}
                    p2={vec((shadow.worldX + shadow.width / 2 + lighting.shadow.x) * camera.zoom, (shadow.worldY + lighting.shadow.y) * camera.zoom)}
                    strokeCap="round"
                    strokeWidth={4 * camera.zoom}
                  />
                ) : null}
                <RoundedRect
                  color={lighting.shadow.color}
                  height={4 * camera.zoom}
                  r={2 * camera.zoom}
                  width={shadow.width * camera.zoom}
                  x={shadow.worldX * camera.zoom}
                  y={shadow.worldY * camera.zoom}
                />
              </Group>
            ))}
            {worldFrame.thresholds.map((door) => (
              <Group key={`threshold-${door.id}`}>
                <RoundedRect color={door.darkColor} height={5 * camera.zoom} r={camera.zoom} width={26 * camera.zoom} x={(door.worldX + 3) * camera.zoom} y={(door.worldY + 26) * camera.zoom} />
                <RoundedRect color={door.lightColor} height={camera.zoom} r={camera.zoom / 2} width={20 * camera.zoom} x={(door.worldX + 6) * camera.zoom} y={(door.worldY + 26) * camera.zoom} />
              </Group>
            ))}
            {worldFrame.characterShadows.map((character) => (
              <Group key={`shadow-${character.id}`}>
                <Line
                  color={lighting.shadow.color}
                  p1={vec((character.worldX + 5) * camera.zoom, (character.worldY + 1) * camera.zoom)}
                  p2={vec((character.worldX + character.castX) * camera.zoom, (character.worldY + character.castY) * camera.zoom)}
                  strokeCap="round"
                  strokeWidth={9 * camera.zoom}
                />
                <RoundedRect color={character.color} height={7 * camera.zoom} r={3.5 * camera.zoom} width={22 * camera.zoom} x={(character.worldX - 4) * camera.zoom} y={character.worldY * camera.zoom} />
              </Group>
            ))}
          </Group>
        );
      case 'character':
        return (
          <Group key={layer} transform={atlasCameraTransform}>
            {groundBatches.map((batch, index) => {
              const kind = batch[0]?.kind;
              if (!kind) return null;
              const data = kind === 'prop'
                ? atlasData(batch.map(({ placement }) => placement as WorldPropPlacement), camera.zoom)
                : characterAtlasData(batch.map(({ placement }) => placement as WorldCharacterPlacement), camera.zoom);
              return <Atlas image={image} key={`${kind}-${index}`} sampling={NEAREST} sprites={data.sprites} transforms={data.transforms} />;
            })}
          </Group>
        );
      case 'effect': {
        return (
          <Group key={layer}>
            {vfxMode === 'procedural' ? (
              <ProceduralMapEffects
                camera={vfxCamera}
                colors={worldFrame.effectRoleColors}
                geometries={worldFrame.effects}
              />
            ) : null}
            {worldFrame.fallbackEffects.map((effect) => {
          const screen = worldToScreen(camera, { x: effect.worldX, y: effect.worldY });
          return <Circle color={effect.color} cx={screen.x} cy={screen.y} key={effect.id} r={3 * camera.zoom} />;
            })}
          </Group>
        );
      }
      case 'wall':
        return (
          <Group key={layer} transform={atlasCameraTransform}>
            <Atlas image={image} sampling={NEAREST} sprites={wallAtlas.sprites} transforms={wallAtlas.transforms} />
            {worldFrame.wallBases.map((wall) => (
              <Group key={`wall-base-${wall.id}`}>
                <RoundedRect color={wall.darkColor} height={5 * camera.zoom} r={camera.zoom} width={30 * camera.zoom} x={(wall.worldX + 1) * camera.zoom} y={(wall.worldY + 26) * camera.zoom} />
                <RoundedRect color={wall.lightColor} height={camera.zoom} r={camera.zoom / 2} width={26 * camera.zoom} x={(wall.worldX + 3) * camera.zoom} y={(wall.worldY + 26) * camera.zoom} />
              </Group>
            ))}
          </Group>
        );
      case 'roof':
        return <Group key={layer} transform={atlasCameraTransform}><Atlas image={image} sampling={NEAREST} sprites={roofAtlas.sprites} transforms={roofAtlas.transforms} /></Group>;
    }
  };

  if (!image) return null;

  return (
    <>
      <Canvas style={StyleSheet.flatten([styles.canvas, surface])}>
            {worldFrame.layerOrder.slice(0, 3).map(renderLayer)}
            <Oval
              color={worldFrame.selectionRing.color}
              rect={rect(
                selectedScreen.x - worldFrame.selectionRing.radiusX * camera.zoom,
                selectedScreen.y - worldFrame.selectionRing.radiusY * camera.zoom,
                worldFrame.selectionRing.radiusX * camera.zoom * 2,
                worldFrame.selectionRing.radiusY * camera.zoom * 2,
              )}
              style="stroke"
              strokeWidth={worldFrame.selectionRing.strokeWidth}
            />
            {worldFrame.layerOrder.slice(3, 6).map(renderLayer)}
            {worldFrame.layerOrder.slice(6).map(renderLayer)}
      </Canvas>
      {shelterCells.map((shelter) => {
              const shelterScreen = worldToScreen(camera, { x: shelter.x * TILE_SIZE, y: shelter.y * TILE_SIZE });
              return <View
                key={`${shelter.x},${shelter.y}`}
                pointerEvents="none"
                style={[
                  styles.shelterShade,
                  { backgroundColor: lighting.shelterShade },
                  {
                    height: shelter.height * TILE_SIZE * camera.zoom,
                    left: shelterScreen.x,
                    top: shelterScreen.y,
                    width: shelter.width * TILE_SIZE * camera.zoom,
                  },
                ]}
              />;
      })}
      <DistrictLightingOverlay camera={camera} lighting={worldFrame.lighting} surface={surface} />
      <AtmosphereOverlay atmosphere={worldFrame.atmosphere} reducedMotion={reducedMotion} />
            <Canvas style={StyleSheet.flatten([styles.feedbackCanvas, surface])}>
              {worldFrame.destinationPulse ? (() => {
                const pulse = worldFrame.destinationPulse;
                const screen = worldToScreen(camera, { x: pulse.worldX, y: pulse.worldY });
                const alpha = Math.round(pulse.opacity * 255).toString(16).padStart(2, '0');
                return <Circle color={`${pulse.color}${alpha}`} cx={screen.x} cy={screen.y} r={pulse.radius * camera.zoom} style="stroke" strokeWidth={camera.zoom} />;
              })() : null}
              {worldFrame.journalMarkers.map((marker) => {
                const foot = worldToScreen(camera, tileFootPoint(marker.tile));
                const centerX = foot.x - 10 * camera.zoom;
                const centerY = foot.y - 30 * camera.zoom;
                return (
                  <Group key={`journal-marker-${marker.journalEntryId}`}>
                    <Line color={marker.darkColor} p1={vec(centerX, centerY + 4 * camera.zoom)} p2={vec(foot.x - 4 * camera.zoom, foot.y - 5 * camera.zoom)} strokeWidth={4 * camera.zoom} />
                    <Line color={marker.lightColor} p1={vec(centerX, centerY + 4 * camera.zoom)} p2={vec(foot.x - 4 * camera.zoom, foot.y - 5 * camera.zoom)} strokeWidth={2 * camera.zoom} />
                    <Circle color={marker.darkColor} cx={centerX} cy={centerY} r={7 * camera.zoom} />
                    <Circle color={marker.lightColor} cx={centerX} cy={centerY} r={5 * camera.zoom} />
                    <Circle color={marker.darkColor} cx={centerX} cy={centerY} r={2 * camera.zoom} />
                  </Group>
                );
              })}
              {feedbackScreen && worldFrame.failureMarker ? (
                <>
                  <Line color={worldFrame.failureMarker.color} p1={vec(feedbackScreen.x - worldFrame.failureMarker.radiusPixels, feedbackScreen.y - worldFrame.failureMarker.radiusPixels)} p2={vec(feedbackScreen.x + worldFrame.failureMarker.radiusPixels, feedbackScreen.y + worldFrame.failureMarker.radiusPixels)} strokeWidth={3} />
                  <Line color={worldFrame.failureMarker.color} p1={vec(feedbackScreen.x + worldFrame.failureMarker.radiusPixels, feedbackScreen.y - worldFrame.failureMarker.radiusPixels)} p2={vec(feedbackScreen.x - worldFrame.failureMarker.radiusPixels, feedbackScreen.y + worldFrame.failureMarker.radiusPixels)} strokeWidth={3} />
                </>
              ) : null}
            </Canvas>
    </>
  );
}

const styles = StyleSheet.create({
  // Copied verbatim from WorldScene. The clear colour matches the Three.js renderer, so any area
  // the world does not cover reads the same on both paths.
  canvas: { backgroundColor: '#b77945' },
  feedbackCanvas: { left: 0, position: 'absolute', top: 0 },
  shelterShade: { position: 'absolute' },
});
