import { z } from 'zod';

import { StableIdSchema } from '../state/ids';

export const InvitationStatusSchema = z.enum([
  'accepted',
  'rejected',
  'countered',
  'cancelled',
  'replan_required',
  'completed',
]);

export const InvitationStateSchema = z.object({
  id: StableIdSchema,
  npcId: StableIdSchema,
  sourceConversationId: StableIdSchema,
  actionId: z.literal('invite_home'),
  destinationLocationId: z.literal('protagonist_villa'),
  destinationMapId: z.literal('northwest_residential'),
  proposedMinute: z.number().int().nonnegative(),
  scheduledMinute: z.number().int().nonnegative().optional(),
  counterProposedMinute: z.number().int().nonnegative().optional(),
  durationMinutes: z.number().int().min(30).max(360),
  status: InvitationStatusSchema,
  responseReasonId: StableIdSchema,
  feedback: z.string().trim().min(1).max(240),
  transferId: StableIdSchema.optional(),
  preparedAtMinute: z.number().int().nonnegative().optional(),
}).strict().superRefine((invitation, context) => {
  if (['accepted', 'completed', 'cancelled'].includes(invitation.status) && invitation.scheduledMinute === undefined) {
    context.addIssue({ code: 'custom', message: 'Accepted invitation history requires a scheduled minute.' });
  }
  if (invitation.status === 'countered' && invitation.counterProposedMinute === undefined) {
    context.addIssue({ code: 'custom', message: 'A countered invitation requires another proposed minute.' });
  }
  if (invitation.status === 'rejected' && (invitation.scheduledMinute !== undefined || invitation.transferId !== undefined)) {
    context.addIssue({ code: 'custom', message: 'A rejected invitation cannot reserve time or travel.' });
  }
  if (invitation.transferId !== undefined && invitation.status !== 'accepted') {
    context.addIssue({ code: 'custom', message: 'Only an accepted invitation can own a travel reservation.' });
  }
  if (invitation.preparedAtMinute !== undefined && invitation.status !== 'accepted') {
    context.addIssue({ code: 'custom', message: 'Only an accepted invitation can own local visit preparation.' });
  }
  if (invitation.preparedAtMinute !== undefined && invitation.transferId !== undefined) {
    context.addIssue({ code: 'custom', message: 'An invitation cannot be locally prepared and in cross-map travel at once.' });
  }
});
export type InvitationState = z.infer<typeof InvitationStateSchema>;

export const HomeInvitationRequestSchema = z.object({
  invitationId: StableIdSchema,
  npcId: StableIdSchema,
  sourceConversationId: StableIdSchema,
  proposedMinute: z.number().int().nonnegative(),
  durationMinutes: z.number().int().min(30).max(360).default(120),
}).strict();
export type HomeInvitationRequest = z.infer<typeof HomeInvitationRequestSchema>;
