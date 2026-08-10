import type { ScheduleStateSchema } from '../../domain/state/models';
import type { z } from 'zod';

export type ScheduleState = z.infer<typeof ScheduleStateSchema>;
export type ScheduleMilestone = Readonly<{
  id: string;
  minute: number;
  scheduleId: string;
  npcId: string;
  blockIndex: number;
  block: ScheduleState['blocks'][number];
}>;

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function scheduleMilestonesBetween(
  schedules: Readonly<Record<string, ScheduleState>>,
  fromMinute: number,
  toMinute: number,
): ScheduleMilestone[] {
  const milestones: ScheduleMilestone[] = [];
  const firstDay = Math.floor(fromMinute / 1_440);
  const lastDay = Math.floor(toMinute / 1_440);
  for (let day = firstDay; day <= lastDay; day += 1) {
    for (const schedule of Object.values(schedules)) {
      schedule.blocks.forEach((block, blockIndex) => {
        const minute = day * 1_440 + block.startMinuteOfDay;
        if (minute <= fromMinute || minute > toMinute) return;
        milestones.push({
          id: `schedule-${schedule.npcId}-${day}-${blockIndex}`,
          minute,
          scheduleId: schedule.id,
          npcId: schedule.npcId,
          blockIndex,
          block,
        });
      });
    }
  }
  return milestones.sort((left, right) => left.minute - right.minute || compareAscii(left.id, right.id));
}

export function activeScheduleBlock(schedule: ScheduleState, absoluteMinute: number) {
  const minuteOfDay = absoluteMinute % 1_440;
  return [...schedule.blocks].reverse().find(({ startMinuteOfDay }) => startMinuteOfDay <= minuteOfDay)
    ?? schedule.blocks.at(-1)!;
}
