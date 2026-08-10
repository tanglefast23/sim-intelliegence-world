export type SocialPurchase = Readonly<{
  id: string;
  displayName: string;
  cost: number;
  questId: string;
  grantedQuestFlagId: string;
  benefit: 'relationship_route' | 'faction_route' | 'practical_quest_advantage';
}>;

export const SOCIAL_PURCHASES: Readonly<Record<string, SocialPurchase>> = Object.freeze({
  security_report: {
    id: 'security_report',
    displayName: 'Villa security report',
    cost: 60,
    questId: 'linda_boyfriend_check',
    grantedQuestFlagId: 'security_report_purchased',
    benefit: 'practical_quest_advantage',
  },
});

export function socialPurchase(offerId: string): SocialPurchase {
  const offer = SOCIAL_PURCHASES[offerId];
  if (!offer) throw new Error(`Unknown social purchase: ${offerId}`);
  return offer;
}
