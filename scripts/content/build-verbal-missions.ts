import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const OUTCOMES = [
  'clarify', 'small_talk', 'progress', 'repeat', 'backfire', 'lie_detected',
  'offer_too_low', 'cannot_pay', 'ready', 'refused', 'walkout',
] as const;

const OUTCOME_COPY = {
  clarify: 'The request is unclear.',
  small_talk: 'The conversation stays friendly, but the concern does not move.',
  progress: 'The point lands. Something in the conversation shifts.',
  repeat: 'This point has already been heard. Repeating it adds nothing.',
  backfire: 'The approach crosses a line and makes the conversation harder.',
  lie_detected: 'The claim conflicts with verified facts. Trust in this argument drops.',
  offer_too_low: 'The offer is below the price this sale can accept.',
  cannot_pay: 'The offered amount is not available to spend.',
  ready: 'Every required concern is answered. The exact result is ready to confirm.',
  refused: 'The proposed term cannot be accepted as stated.',
  walkout: 'A hard boundary ends this attempt.',
} as const;

function reactions(prefix: string, npcName: string) {
  return OUTCOMES.map((outcome) => ({
    reactionId: `${prefix}_${outcome}`,
    outcome,
    readTheRoomId: `${prefix}_read_${outcome}`,
    portraitId: outcome === 'ready' ? 'warm'
      : ['backfire', 'lie_detected', 'refused', 'walkout'].includes(outcome) ? 'guarded'
        : ['offer_too_low', 'cannot_pay'].includes(outcome) ? 'hurt'
          : outcome === 'progress' ? 'considering' : 'neutral',
    cueId: outcome === 'ready' ? 'consequence' : ['backfire', 'walkout'].includes(outcome) ? 'sigh' : null,
    actorFallback: outcome === 'ready'
      ? `${npcName} is ready for you to confirm the exact terms.`
      : outcome === 'walkout'
        ? `${npcName} ends the conversation after that boundary is crossed.`
        : OUTCOME_COPY[outcome],
  }));
}

function defaultReactionIds(prefix: string) {
  return Object.fromEntries(OUTCOMES.map((outcome) => [outcome, `${prefix}_${outcome}`]));
}

function readTheRoomLines(prefix: string, subject: string) {
  return Object.fromEntries(OUTCOMES.map((outcome) => [
    `${prefix}_read_${outcome}`,
    `${subject} ${OUTCOME_COPY[outcome][0]!.toLocaleLowerCase('en')}${OUTCOME_COPY[outcome].slice(1)}`,
  ]));
}

const tomasContext = {
  playerFactIds: [], npcFactIds: [], contradictedFactIds: [], playerMoney: 800,
  objectOwners: { linda_marchetti_purse: 'linda' }, absoluteMinute: 480,
};

const tomas = {
  disposition: {
    dispositionId: 'tomas_procedural_disposition', npcId: 'tomas_reed',
    protectedValueIds: ['public_record_integrity'], credibilitySignalIds: ['clear_public_purpose'],
    suspicionSignalIds: ['pressure', 'rumor'], decisionStyle: 'procedural', patience: 6,
    repetitionTolerance: 1, verificationMethodIds: ['public_timetable'],
    hardBoundaries: [{ boundaryId: 'tomas_no_threats', trigger: { actIds: ['threaten'] } }],
  },
  definition: {
    schemaVersion: 1, missionId: 'tomas_after_dark_ferry', npcId: 'tomas_reed',
    dispositionId: 'tomas_procedural_disposition',
    concerns: [{ concernId: 'procedure', summary: 'Tomas needs a clear public request he can answer from the timetable.', required: true, initialState: 'open' }],
    levers: [{
      leverId: 'read_public_timetable', stableOrder: 1, concernId: 'procedure', honest: true, credits: true,
      trigger: { actIds: ['observe'], referentId: 'ferry_after_dark_route' },
      requiredPlayerFactIds: [], requiredNpcFactIds: [], fromStates: ['open'], toState: 'eased',
      newlySpeakableFactIds: [], reactionId: 'tomas_progress',
    }, {
      leverId: 'make_formal_ferry_request', stableOrder: 2, concernId: 'procedure', honest: true, credits: true,
      trigger: { actIds: ['ask'], registerIds: ['formal'], referentId: 'ferry_after_dark_route' },
      requiredPlayerFactIds: [], requiredNpcFactIds: [], fromStates: ['eased'], toState: 'resolved',
      newlySpeakableFactIds: ['ferry_after_dark_route'], reactionId: 'tomas_progress',
    }],
    allergies: [], recoveries: [], reactions: reactions('tomas', 'Tomas'),
    defaultReactionIds: defaultReactionIds('tomas'),
    goalContract: {
      kind: 'disclose_fact', missionId: 'tomas_after_dark_ferry', npcId: 'tomas_reed',
      requiredConcernIds: ['procedure'], availableWhenId: 'tomas_ferry_available',
      confirmRuleId: 'tomas_ferry_ready', successRuleId: 'tomas_ferry_disclosed',
      closerActionId: 'record_tomas_ferry_disclosure', factId: 'ferry_after_dark_route',
      recipientId: 'protagonist', commandType: 'record_fact_disclosure',
    },
    honestRoute: {
      proofId: 'tomas_public_timetable_trace', context: tomasContext,
      steps: [{
        playerMessage: 'The public timetable shows an after-dark ferry.',
        move: { acts: [{ act: 'observe', referentId: 'ferry_after_dark_route', evidenceText: 'public timetable' }], register: 'plain', claims: [], referenceConfidence: 'clear' },
        exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [],
      }, {
        playerMessage: 'Please tell me which ferry runs after dark.',
        move: { acts: [{ act: 'ask', referentId: 'ferry_after_dark_route', evidenceText: 'which ferry runs after dark' }], register: 'formal', claims: [], referenceConfidence: 'clear' },
        exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [],
      }],
    },
    recoveryProofs: [],
  },
  referents: [
    { id: 'protagonist', label: 'you', aliases: ['me', 'myself'] },
    { id: 'ferry_after_dark_route', label: 'after-dark ferry route', aliases: ['night ferry', 'late ferry', 'timetable'] },
  ],
  facts: [{ id: 'ferry_after_dark_route', description: 'the public ferry route that still runs after dark', aliases: ['night ferry', 'late ferry'] }],
  readTheRoomLines: readTheRoomLines('tomas', 'Tomas'),
  speakableFactTexts: { ferry_after_dark_route: 'The southeast night ferry is the public route that still runs after dark.' },
};

const lindaContext = {
  playerFactIds: ['linda_quick_consignment_net'], npcFactIds: [], contradictedFactIds: [], playerMoney: 800,
  objectOwners: { linda_marchetti_purse: 'linda' }, absoluteMinute: 720,
};

const linda = {
  disposition: {
    dispositionId: 'linda_purse_disposition', npcId: 'linda',
    protectedValueIds: ['independence', 'dignity'], credibilitySignalIds: ['specific_use', 'verified_value'],
    suspicionSignalIds: ['generic_flattery', 'pressure'], decisionStyle: 'relational', patience: 6,
    repetitionTolerance: 1, verificationMethodIds: ['consignment_appraisal', 'cash_check'],
    hardBoundaries: [{ boundaryId: 'linda_no_threats', trigger: { actIds: ['threaten'] } }],
  },
  definition: {
    schemaVersion: 1, missionId: 'linda_marchetti_purse_sale', npcId: 'linda',
    dispositionId: 'linda_purse_disposition',
    concerns: [
      { concernId: 'purpose', summary: 'Linda needs a concrete reason the purse will be used, not collected as a trophy.', required: true, initialState: 'hidden' },
      { concernId: 'value', summary: 'The price must reflect a fair private sale.', required: true, initialState: 'open' },
      { concernId: 'dignity', summary: 'The approach must respect Linda and the purse history.', required: true, initialState: 'open' },
      { concernId: 'payment', summary: 'The exact payment must be available now.', required: true, initialState: 'open' },
    ],
    levers: [{
      leverId: 'ask_purse_history', stableOrder: 1, concernId: 'purpose', honest: true, credits: false,
      trigger: { actIds: ['ask'], referentId: 'linda_marchetti_purse' }, requiredPlayerFactIds: [], requiredNpcFactIds: [],
      fromStates: ['hidden'], toState: 'open', newlySpeakableFactIds: ['linda_purse_independence_story'], reactionId: 'linda_progress',
    }, {
      leverId: 'state_personal_use', stableOrder: 2, concernId: 'purpose', honest: true, credits: true,
      trigger: { actIds: ['assert'], referentId: 'linda_marchetti_purse', forbiddenRegisterIds: ['flattering', 'threatening'] },
      requiredPlayerFactIds: [], requiredNpcFactIds: [], fromStates: ['open'], toState: 'resolved', newlySpeakableFactIds: [], reactionId: 'linda_progress',
    }, {
      leverId: 'honour_independence_story', stableOrder: 3, concernId: 'purpose', honest: true, credits: true,
      trigger: { actIds: ['empathize'], referentId: 'linda_marchetti_purse', claimFactIds: ['linda_purse_independence_story'] },
      requiredPlayerFactIds: ['linda_purse_independence_story'], requiredNpcFactIds: [], fromStates: ['open'], toState: 'resolved', newlySpeakableFactIds: [], reactionId: 'linda_progress',
    }, {
      leverId: 'verified_consignment_value', stableOrder: 4, concernId: 'value', honest: true, credits: true,
      trigger: { actIds: ['assert'], referentId: 'linda_marchetti_purse', claimFactIds: ['linda_quick_consignment_net'] },
      requiredPlayerFactIds: ['linda_quick_consignment_net'], requiredNpcFactIds: [], fromStates: ['open'], toState: 'resolved', newlySpeakableFactIds: [], reactionId: 'linda_progress',
    }, {
      leverId: 'observe_worn_clasp', stableOrder: 5, concernId: 'value', honest: true, credits: true,
      trigger: { actIds: ['observe'], referentId: 'linda_marchetti_purse', claimFactIds: ['linda_purse_worn_clasp'] },
      requiredPlayerFactIds: ['linda_purse_worn_clasp'], requiredNpcFactIds: [], fromStates: ['open'], toState: 'resolved', newlySpeakableFactIds: [], reactionId: 'linda_progress',
    }, {
      leverId: 'respect_purse_history', stableOrder: 6, concernId: 'dignity', honest: true, credits: true,
      trigger: { actIds: ['empathize'], registerIds: ['warm'], referentId: 'linda_marchetti_purse' },
      requiredPlayerFactIds: [], requiredNpcFactIds: [], fromStates: ['open'], toState: 'resolved', newlySpeakableFactIds: [], reactionId: 'linda_progress',
    }, {
      leverId: 'formal_private_sale', stableOrder: 7, concernId: 'dignity', honest: true, credits: true,
      trigger: { actIds: ['assert'], registerIds: ['formal'], referentId: 'linda_marchetti_purse' },
      requiredPlayerFactIds: [], requiredNpcFactIds: [], fromStates: ['open'], toState: 'resolved', newlySpeakableFactIds: [], reactionId: 'linda_progress',
    }, {
      leverId: 'exact_private_offer', stableOrder: 8, concernId: 'payment', honest: true, credits: true,
      trigger: { actIds: ['offer'], referentId: 'linda_marchetti_purse', forbiddenRegisterIds: ['threatening'] },
      requiredPlayerFactIds: [], requiredNpcFactIds: [], fromStates: ['open', 'eased'], toState: 'resolved',
      exactTerm: { kind: 'offer', minimumAmount: 80, maximumAmount: null, requireAffordable: true }, newlySpeakableFactIds: [], reactionId: 'linda_progress',
    }, {
      leverId: 'cash_ready', stableOrder: 9, concernId: 'payment', honest: true, credits: true,
      trigger: { actIds: ['trade'], referentId: 'linda_marchetti_purse', claimFactIds: ['linda_cash_payment_ready'] },
      requiredPlayerFactIds: ['linda_cash_payment_ready'], requiredNpcFactIds: [], fromStates: ['open'], toState: 'eased', newlySpeakableFactIds: [], reactionId: 'linda_progress',
    }],
    allergies: [{
      allergyId: 'linda_generic_flattery', stableOrder: 1, trigger: { registerIds: ['flattering'] }, severity: 'mild',
      concernId: 'dignity', recoveryIds: ['linda_plain_apology'], patienceDelta: -1, reactionId: 'linda_backfire',
    }],
    recoveries: [{
      recoveryId: 'linda_plain_apology', stableOrder: 1, concernId: 'dignity', trigger: { actIds: ['apologize'], forbiddenRegisterIds: ['flattering'] },
      requiredPlayerFactIds: [], toState: 'open', sameConversation: true, reactionId: 'linda_progress',
    }],
    reactions: reactions('linda', 'Linda'), defaultReactionIds: defaultReactionIds('linda'),
    goalContract: {
      kind: 'buy_object', missionId: 'linda_marchetti_purse_sale', npcId: 'linda', requiredConcernIds: ['purpose', 'value', 'dignity', 'payment'],
      availableWhenId: 'linda_purse_available', confirmRuleId: 'linda_purse_sale_legal', successRuleId: 'linda_purse_under_100',
      closerActionId: 'buy_linda_marchetti_purse', objectId: 'linda_marchetti_purse', successPriceExclusive: 100, hardMinimumPrice: 80,
      commandType: 'purchase_unique_object',
    },
    honestRoute: {
      proofId: 'linda_appraisal_trace', context: lindaContext,
      steps: [{
        playerMessage: 'Why does the purse matter to you?',
        move: { acts: [{ act: 'ask', referentId: 'linda_marchetti_purse', evidenceText: 'Why does the purse matter' }], register: 'warm', claims: [], referenceConfidence: 'clear' },
        exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [],
      }, {
        playerMessage: 'I would use the purse, and the appraisal says a quick sale nets $85.',
        move: { acts: [{ act: 'assert', referentId: 'linda_marchetti_purse', evidenceText: 'I would use the purse' }], register: 'plain', claims: [{ factId: 'linda_quick_consignment_net', polarity: 'assert', evidenceText: 'appraisal' }], referenceConfidence: 'clear' },
        exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [],
      }, {
        playerMessage: 'I understand why its history deserves respect.',
        move: { acts: [{ act: 'empathize', referentId: 'linda_marchetti_purse', evidenceText: 'history deserves respect' }], register: 'warm', claims: [], referenceConfidence: 'clear' },
        exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [],
      }, {
        playerMessage: 'I offer $95 for the purse.',
        move: { acts: [{ act: 'offer', referentId: 'linda_marchetti_purse', evidenceText: '$95' }], register: 'plain', claims: [], referenceConfidence: 'clear' },
        exactOfferAmount: 95, exactProposedMinute: null, grantPlayerFactIds: [],
      }],
    },
    recoveryProofs: [{
      proofId: 'linda_flattery_recovery_trace', allergyId: 'linda_generic_flattery', recoveryId: 'linda_plain_apology', context: lindaContext,
      allergyStep: { playerMessage: 'You are perfect and the purse makes you perfect.', move: { acts: [{ act: 'compliment', referentId: 'linda_marchetti_purse', evidenceText: 'perfect' }], register: 'flattering', claims: [], referenceConfidence: 'clear' }, exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [] },
      recoveryStep: { playerMessage: 'Sorry. That sounded fake.', move: { acts: [{ act: 'apologize', referentId: 'linda_marchetti_purse', evidenceText: 'Sorry' }], register: 'plain', claims: [], referenceConfidence: 'clear' }, exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [] },
    }],
  },
  referents: [{ id: 'linda_marchetti_purse', label: "Linda's black Marchetti purse", aliases: ['purse', 'bag', 'Marchetti'] }],
  facts: [
    { id: 'linda_purse_independence_story', description: 'the purse helped Linda mark her independence', aliases: ['independence story', 'purse history'] },
    { id: 'linda_quick_consignment_net', description: 'a quick consignment sale would net Linda $85', aliases: ['appraisal', 'consignment quote'] },
    { id: 'linda_purse_worn_clasp', description: 'the purse clasp is visibly worn', aliases: ['worn clasp'] },
    { id: 'linda_cash_payment_ready', description: 'the exact cash payment is available', aliases: ['cash ready'] },
  ],
  readTheRoomLines: readTheRoomLines('linda', 'Linda'),
  speakableFactTexts: { linda_purse_independence_story: 'The purse was the first expensive thing Linda bought after becoming independent.' },
};

const priyaContext = {
  playerFactIds: ['priya_injury_transport_evidence', 'priya_patient_consent'], npcFactIds: [], contradictedFactIds: [],
  playerMoney: 800, objectOwners: { linda_marchetti_purse: 'linda' }, absoluteMinute: 720,
};

const priya = {
  disposition: {
    dispositionId: 'priya_clinical_disposition', npcId: 'priya_nair', protectedValueIds: ['patient_consent', 'clinical_safety'],
    credibilitySignalIds: ['documented_injury', 'exact_schedule'], suspicionSignalIds: ['diagnosis_from_gossip', 'pressure'],
    decisionStyle: 'evidence_first', patience: 7, repetitionTolerance: 2, verificationMethodIds: ['patient_record', 'clinic_schedule'],
    hardBoundaries: [{ boundaryId: 'priya_no_threats', trigger: { actIds: ['threaten'] } }],
  },
  definition: {
    schemaVersion: 1, missionId: 'priya_off_island_assessment', npcId: 'priya_nair', dispositionId: 'priya_clinical_disposition',
    concerns: [
      { concernId: 'evidence', summary: 'Priya needs direct evidence of an injury requiring transport assessment.', required: true, initialState: 'open' },
      { concernId: 'consent', summary: 'The patient must consent before Priya agrees.', required: true, initialState: 'open' },
      { concernId: 'capacity', summary: 'The visit needs a precise time within Priya schedule.', required: true, initialState: 'open' },
    ],
    levers: [{
      leverId: 'documented_injury', stableOrder: 1, concernId: 'evidence', honest: true, credits: true,
      trigger: { actIds: ['assert'], referentId: 'linda_boyfriend', claimFactIds: ['priya_injury_transport_evidence'] },
      requiredPlayerFactIds: ['priya_injury_transport_evidence'], requiredNpcFactIds: [], fromStates: ['open'], toState: 'resolved', newlySpeakableFactIds: [], reactionId: 'priya_progress',
    }, {
      leverId: 'observed_injury', stableOrder: 2, concernId: 'evidence', honest: true, credits: true,
      trigger: { actIds: ['observe'], referentId: 'linda_boyfriend', claimFactIds: ['priya_injury_transport_evidence'] },
      requiredPlayerFactIds: ['priya_injury_transport_evidence'], requiredNpcFactIds: [], fromStates: ['open'], toState: 'resolved', newlySpeakableFactIds: [], reactionId: 'priya_progress',
    }, {
      leverId: 'documented_consent', stableOrder: 3, concernId: 'consent', honest: true, credits: true,
      trigger: { actIds: ['assert'], referentId: 'linda_boyfriend', claimFactIds: ['priya_patient_consent'] },
      requiredPlayerFactIds: ['priya_patient_consent'], requiredNpcFactIds: [], fromStates: ['open'], toState: 'resolved', newlySpeakableFactIds: [], reactionId: 'priya_progress',
    }, {
      leverId: 'respect_patient_choice', stableOrder: 4, concernId: 'consent', honest: true, credits: true,
      trigger: { actIds: ['empathize'], referentId: 'linda_boyfriend', claimFactIds: ['priya_patient_consent'] },
      requiredPlayerFactIds: ['priya_patient_consent'], requiredNpcFactIds: [], fromStates: ['open'], toState: 'resolved', newlySpeakableFactIds: [], reactionId: 'priya_progress',
    }, {
      leverId: 'exact_assessment_time', stableOrder: 5, concernId: 'capacity', honest: true, credits: true,
      trigger: { actIds: ['offer'], referentId: 'linda_boyfriend' }, requiredPlayerFactIds: [], requiredNpcFactIds: [], fromStates: ['open', 'eased'], toState: 'resolved',
      exactTerm: { kind: 'schedule', requireWithinContract: true }, newlySpeakableFactIds: [], reactionId: 'priya_progress',
    }, {
      leverId: 'ask_clinic_window', stableOrder: 6, concernId: 'capacity', honest: true, credits: true,
      trigger: { actIds: ['ask'], registerIds: ['formal'], referentId: 'assess_off_island_transport' }, requiredPlayerFactIds: [], requiredNpcFactIds: [],
      fromStates: ['open'], toState: 'eased', newlySpeakableFactIds: [], reactionId: 'priya_progress',
    }],
    allergies: [], recoveries: [], reactions: reactions('priya', 'Priya'), defaultReactionIds: defaultReactionIds('priya'),
    goalContract: {
      kind: 'schedule_cooperation', missionId: 'priya_off_island_assessment', npcId: 'priya_nair', requiredConcernIds: ['evidence', 'consent', 'capacity'],
      availableWhenId: 'priya_assessment_available', confirmRuleId: 'priya_assessment_ready', successRuleId: 'priya_assessment_agreed',
      closerActionId: 'schedule_priya_assessment', actionId: 'assess_off_island_transport', subjectNpcId: 'linda_boyfriend', locationId: 'linda_villa',
      earliestMinute: 600, latestMinute: 10080, commandType: 'create_scheduled_commitment',
    },
    honestRoute: {
      proofId: 'priya_evidence_consent_schedule_trace', context: priyaContext,
      steps: [{
        playerMessage: 'The injury record shows he needs a transport assessment.',
        move: { acts: [{ act: 'assert', referentId: 'linda_boyfriend', evidenceText: 'injury record' }], register: 'formal', claims: [{ factId: 'priya_injury_transport_evidence', polarity: 'assert', evidenceText: 'injury record' }], referenceConfidence: 'clear' },
        exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [],
      }, {
        playerMessage: 'He gave consent for you to assess him.',
        move: { acts: [{ act: 'assert', referentId: 'linda_boyfriend', evidenceText: 'gave consent' }], register: 'plain', claims: [{ factId: 'priya_patient_consent', polarity: 'assert', evidenceText: 'consent' }], referenceConfidence: 'clear' },
        exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [],
      }, {
        playerMessage: 'Can you assess him at 9am tomorrow?',
        move: { acts: [{ act: 'offer', referentId: 'linda_boyfriend', evidenceText: '9am tomorrow' }], register: 'plain', claims: [], referenceConfidence: 'clear' },
        exactOfferAmount: null, exactProposedMinute: 1980, grantPlayerFactIds: [],
      }],
    },
    recoveryProofs: [],
  },
  referents: [
    { id: 'assess_off_island_transport', label: 'off-island transport assessment', aliases: ['assessment', 'transport assessment'] },
    { id: 'linda_boyfriend', label: 'Marcus Vale', aliases: ['Marcus', 'patient', 'him'] },
    { id: 'linda_villa', label: "Linda's villa", aliases: ['villa', 'patient location'] },
  ],
  facts: [
    { id: 'priya_injury_transport_evidence', description: 'the injury record supports a transport assessment', aliases: ['injury record', 'medical evidence'] },
    { id: 'priya_patient_consent', description: 'Marcus consented to Priya assessment', aliases: ['patient consent', 'consent record'] },
  ],
  readTheRoomLines: readTheRoomLines('priya', 'Priya'), speakableFactTexts: {},
};

export async function buildVerbalMissions(rootPath = process.cwd()): Promise<void> {
  const directory = resolve(rootPath, 'content', 'verbal-missions');
  await mkdir(directory, { recursive: true });
  await Promise.all([
    ['tomas-ferry-fact.json', tomas],
    ['linda-purse-deal.json', linda],
    ['priya-transport-assessment.json', priya],
  ].map(([name, content]) => writeFile(resolve(directory, name as string), `${JSON.stringify(content, null, 2)}\n`)));
}

if (require.main === module) {
  buildVerbalMissions().catch((error: unknown) => {
    process.stderr.write(`Verbal Mission content build failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
