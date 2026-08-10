export type GameBootStatus = 'loading' | 'new' | 'active' | 'failed';

export function shouldReportGameReady(status: GameBootStatus): boolean {
  return status === 'new' || status === 'active';
}
