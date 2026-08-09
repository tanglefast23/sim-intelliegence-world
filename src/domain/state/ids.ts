import { z } from 'zod';

export const StableIdSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/u);
export const EventIdSchema = z.string().regex(/^event-[a-z0-9][a-z0-9-]*$/u);
export const CommandIdSchema = z.string().regex(/^command-[a-z0-9][a-z0-9-]*$/u);
export const PauseTokenSchema = z.string().regex(/^pause:[a-z][a-z0-9-]*:[a-z0-9-]+$/u);

export type StableId = z.infer<typeof StableIdSchema>;
export type EventId = z.infer<typeof EventIdSchema>;
export type CommandId = z.infer<typeof CommandIdSchema>;
export type PauseToken = z.infer<typeof PauseTokenSchema>;

export const PROTAGONIST_ID = 'protagonist' as const;
