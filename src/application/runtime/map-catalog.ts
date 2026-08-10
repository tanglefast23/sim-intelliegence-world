import northeastMapJson from '../../../content/maps/northeast.json';
import northwestMapJson from '../../../content/maps/northwest.json';
import southeastMapJson from '../../../content/maps/southeast.json';
import southwestMapJson from '../../../content/maps/southwest.json';
import { ATLAS_INDEX } from '../../render/atlas';
import { buildWorldMapCatalog } from '../../world/maps/catalog';

export const WORLD_MAP_CATALOG = buildWorldMapCatalog({
  northwest_residential: northwestMapJson,
  northeast_downtown: northeastMapJson,
  southwest_commercial: southwestMapJson,
  southeast_docks: southeastMapJson,
}, new Set(ATLAS_INDEX.tiles));
