import { createInitialState } from '../../domain/state/initial-state';
import { WorldStateSchema } from '../../domain/state/schema';
import { journalMapMarkers } from '../journal-markers';

function stateWithMarker(markerVisible: boolean, locationId = 'linda_villa') {
  const initial = createInitialState();
  return WorldStateSchema.parse({
    ...initial,
    journal: {
      journal_linda_boyfriend: {
        id: 'journal_linda_boyfriend',
        questId: 'linda_boyfriend_check',
        summary: 'Exact villa location confirmed.',
        locationPrecision: 'exact',
        locationId,
        markerVisible,
        source: { type: 'scene_observation', sourceId: 'linda_villa_arrival' },
        resolutionState: 'open',
        outcomeReceipts: [],
      },
    },
  });
}

describe('journal map markers', () => {
  const map = {
    areaById: new Map([
      ['sunward-patio', { entranceTiles: [{ x: 23, y: 28 }] }],
    ]),
    locationBindingById: new Map([
      ['linda_villa', {
        locationId: 'linda_villa',
        areaIds: ['sunward-patio'],
        preferredInteractionIds: [],
        candidateTiles: [{ x: 20, y: 25 }, { x: 22, y: 28 }],
        preferredApproachTiles: [],
      }],
      ['preferred_location', {
        locationId: 'preferred_location',
        areaIds: ['social'],
        preferredInteractionIds: ['social-seat'],
        candidateTiles: [{ x: 10, y: 10 }],
        preferredApproachTiles: [{ x: 12, y: 12 }],
      }],
    ]),
  };

  test('does not expose an unapproved or unbound journal location', () => {
    expect(journalMapMarkers(stateWithMarker(false).journal, map)).toEqual([]);
    expect(journalMapMarkers(stateWithMarker(true, 'other_map_location').journal, map)).toEqual([]);
  });

  test('renders an approved marker from the current map location binding', () => {
    expect(journalMapMarkers(stateWithMarker(true).journal, map)).toEqual([{
      journalEntryId: 'journal_linda_boyfriend',
      locationId: 'linda_villa',
      tile: { x: 23, y: 28 },
    }]);
  });

  test('uses an authored preferred approach before a general location tile', () => {
    expect(journalMapMarkers(stateWithMarker(true, 'preferred_location').journal, map)[0]?.tile).toEqual({ x: 12, y: 12 });
  });
});
