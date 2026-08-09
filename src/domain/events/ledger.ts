import type { DomainEvent } from './types';

export function hasEvent(events: readonly DomainEvent[], eventId: string): boolean {
  return events.some((event) => event.eventId === eventId);
}

export function appendEvent(events: readonly DomainEvent[], event: DomainEvent): DomainEvent[] {
  if (hasEvent(events, event.eventId)) {
    return [...events];
  }
  return [...events, event];
}
