import { reduceCommand } from '../../domain/commands/reducer';
import { DomainCommandSchema } from '../../domain/commands/types';
import type { WorldState } from '../../domain/state/schema';
import type { CompiledMapV2 } from '../../world/maps/compiled-v2';
import { tileKey } from '../../world/maps/schema';
import type { MapId, WorldMapV2Catalog } from '../../world/maps/catalog';

export type MapLoadPort = (mapId: MapId) => Promise<CompiledMapV2>;

export type TransitionResult = Readonly<{
  completed: boolean;
  state: WorldState;
  map: CompiledMapV2;
  feedback?: string;
}>;

export function canStartPortalTransition(input: Readonly<{
  arrivalLocked: boolean;
  transitioning: boolean;
  movementStatus: string;
  conversationOpen: boolean;
  panelOpen: boolean;
}>): boolean {
  return !input.arrivalLocked && !input.transitioning && input.movementStatus !== 'moving' &&
    !input.conversationOpen && !input.panelOpen;
}

function idPart(value: string): string {
  return value.replaceAll('_', '-');
}

function pauseCommand(state: WorldState, token: string, action: 'add-pause-token' | 'remove-pause-token') {
  const verb = action === 'add-pause-token' ? 'start' : 'finish';
  const suffix = `${verb}-transition-${state.revision + 1}-${state.clock.absoluteMinute}`;
  return reduceCommand(state, DomainCommandSchema.parse({
    type: action,
    commandId: `command-${suffix}`,
    eventId: `event-${suffix}`,
    scheduledMinute: state.clock.absoluteMinute,
    priority: -100,
    token,
  })).state;
}

function transitionCommand(
  state: WorldState,
  originMapId: MapId,
  destinationMapId: MapId,
  sourcePortalId: string,
  destinationEntranceId: string,
  tile: Readonly<{ x: number; y: number }>,
): WorldState {
  const suffix = [
    state.revision + 1,
    idPart(originMapId),
    idPart(destinationMapId),
    idPart(sourcePortalId),
  ].join('-');
  return reduceCommand(state, DomainCommandSchema.parse({
    type: 'transition-protagonist',
    commandId: `command-transition-${suffix}`,
    eventId: `event-transition-${suffix}`,
    scheduledMinute: state.clock.absoluteMinute,
    priority: 0,
    originMapId,
    destinationMapId,
    sourcePortalId,
    destinationEntranceId,
    tileX: tile.x,
    tileY: tile.y,
  })).state;
}

function chooseArrivalTile(
  destination: CompiledMapV2,
  entranceTile: Readonly<{ x: number; y: number }>,
  destinationBlockers: ReadonlySet<string>,
): Readonly<{ tile: Readonly<{ x: number; y: number }>; staged: boolean }> {
  if (!destinationBlockers.has(tileKey(entranceTile))) return { tile: entranceTile, staged: false };
  const stagingTile = destination.source.stagingTiles.find((candidate) => (
    !destination.blockedKeys.has(tileKey(candidate)) && !destinationBlockers.has(tileKey(candidate))
  ));
  if (!stagingTile) throw new Error('The destination entrance and all staging tiles are occupied.');
  return { tile: stagingTile, staged: true };
}

export async function transitionNeighborhood(input: Readonly<{
  state: WorldState;
  catalog: WorldMapV2Catalog;
  sourcePortalId: string;
  loadMap: MapLoadPort;
  destinationBlockers?: ReadonlySet<string>;
  onPaused?: (state: WorldState) => void;
}>): Promise<TransitionResult> {
  const originMapId = input.state.protagonist.worldPosition.mapId as MapId;
  const origin = input.catalog[originMapId];
  if (!origin) throw new Error(`The active map ${originMapId} is not in the world catalog.`);
  const sourcePortal = origin.portalById.get(input.sourcePortalId);
  if (!sourcePortal) throw new Error(`The active map has no portal ${input.sourcePortalId}.`);
  const position = input.state.protagonist.worldPosition;
  if (position.tileX !== sourcePortal.tile.x || position.tileY !== sourcePortal.tile.y) {
    throw new Error('The protagonist must stand on the exact source portal tile.');
  }

  const destinationMapId = sourcePortal.destinationMapId as MapId;
  const pauseToken = `pause:transition:${idPart(originMapId)}-${idPart(sourcePortal.id)}`;
  const paused = pauseCommand(input.state, pauseToken, 'add-pause-token');
  input.onPaused?.(paused);

  try {
    const loaded = await input.loadMap(destinationMapId);
    if (loaded.source.id !== destinationMapId) {
      throw new Error(`Loaded map ${loaded.source.id} does not match ${destinationMapId}.`);
    }
    const entrance = loaded.portalById.get(sourcePortal.destinationEntranceId);
    if (
      !entrance ||
      entrance.destinationMapId !== originMapId ||
      entrance.destinationEntranceId !== sourcePortal.id
    ) {
      throw new Error('The loaded destination has no reciprocal entrance.');
    }
    const arrival = chooseArrivalTile(
      loaded,
      entrance.tile,
      input.destinationBlockers ?? new Set<string>(),
    );
    const transitioned = transitionCommand(
      paused,
      originMapId,
      destinationMapId,
      sourcePortal.id,
      entrance.id,
      arrival.tile,
    );
    const stable = pauseCommand(transitioned, pauseToken, 'remove-pause-token');
    return {
      completed: true,
      state: stable,
      map: loaded,
      feedback: arrival.staged ? 'Entrance occupied; moved to a staging tile.' : undefined,
    };
  } catch (error) {
    const stableSource = pauseCommand(paused, pauseToken, 'remove-pause-token');
    return {
      completed: false,
      state: stableSource,
      map: origin,
      feedback: error instanceof Error ? error.message : 'The destination failed to load.',
    };
  }
}
