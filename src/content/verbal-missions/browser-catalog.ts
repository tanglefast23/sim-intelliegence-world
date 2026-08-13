import linda from '../../../content/verbal-missions/linda-purse-deal.json';
import priya from '../../../content/verbal-missions/priya-transport-assessment.json';
import tomas from '../../../content/verbal-missions/tomas-ferry-fact.json';
import { createVerbalMissionContentStore } from './catalog';

export const BROWSER_VERBAL_MISSION_CONTENT = createVerbalMissionContentStore([tomas, linda, priya]);
