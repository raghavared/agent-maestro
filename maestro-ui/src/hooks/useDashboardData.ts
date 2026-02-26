import { useMemo } from 'react';
import {
  MaestroTask,
  MaestroSession,
  TeamMember,
  TaskStatus,
  TaskPriority,
} from '../app/types/maestro';
import type { BoardTask } from './useMultiProjectTasks';
import {
  startOfDay,
  endOfDay,
  subDays,
  subMonths,
  eachDayOfInterval,
  format,
  isWithinInterval,
  differenceInMinutes,
  startOfWeek,
  parseISO,
  isBefore,
  isAfter,
} from 'date-fns';

// ── Time Range Presets ──

export type TimeRangePreset = '7d' | '14d' | '30d' | '90d' | '6m' | '1y' | 'all';

export interface TimeRange {
  start: Date;
  end: Date;
  preset: TimeRangePreset;
}

export function getTimeRange(preset: TimeRangePreset): TimeRange {
  const end = endOfDay(new Date());
  let start: Date;
  switch (preset) {
    case '7d': start = startOfDay(subDays(end, 7)); break;
    case '14d': start = startOfDay(subDays(end, 14)); break;
    case '30d': start = startOfDay(subDays(end, 30)); break;
    case '90d': start = startOfDay(subDays(end, 90)); break;
    case '6m': start = startOfDay(subMonths(end, 6)); break;
    case '1y': start = startOfDay(subMonths(end, 12)); break;
    case 'all': start = new Date(0); break;
  }
  return { start, end, preset };
}

// ── Metric Types ──

export interface OverviewMetrics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  todoTasks: number;
  inReviewTasks: number;
  cancelledTasks: number;
  completionRate: number;
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
  totalTeamMembers: number;
  totalTeams: number;
  overdueTasks: number;
  upcomingDueTasks: number;
}

export interface DailyDataPoint {
  date: string; // YYYY-MM-DD
  label: string; // display label
  tasksCreated: number;
  tasksCompleted: number;
  sessionsSpawned: number;
  sessionsCompleted: number;
}

export interface TasksByStatusData {
  status: string;
  count: number;
  color: string;
}

export interface TasksByPriorityData {
  priority: string;
  count: number;
  color: string;
}

export interface TeamMemberStat {
  id: string;
  name: string;
  avatar: string;
  role: string;
  tasksAssigned: number;
  tasksCompleted: number;
  sessionsRun: number;
  completionRate: number;
}

export interface CalendarDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface DueDateItem {
  taskId: string;
  title: string;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectName?: string;
  projectColor?: string;
  isOverdue: boolean;
}

export interface DashboardData {
  overview: OverviewMetrics;
  dailyData: DailyDataPoint[];
  tasksByStatus: TasksByStatusData[];
  tasksByPriority: TasksByPriorityData[];
  teamMemberStats: TeamMemberStat[];
  calendarData: CalendarDay[];
  dueDateItems: DueDateItem[];
  avgCompletionTimeMinutes: number | null;
}

// ── Status/Priority Colors ──

const STATUS_COLORS: Record<string, string> = {
  todo: 'rgba(120, 180, 255, 0.7)',
  in_progress: '#00d9ff',
  in_review: '#a855f7',
  completed: '#4ade80',
  blocked: '#ef4444',
  cancelled: '#6b7280',
  archived: '#374151',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ff6464',
  medium: '#ffb000',
  low: 'rgba(120, 180, 255, 0.5)',
};

// ── Main Hook ──

export function useDashboardData(
  tasks: BoardTask[],
  sessions: MaestroSession[],
  teamMembers: TeamMember[],
  timeRange: TimeRange,
): DashboardData {
  return useMemo(() => {
    const { start, end } = timeRange;
    const now = new Date();
    const interval = { start, end };

    // Filter root tasks (no parentId) within time range
    const rootTasks = tasks.filter((t) => !t.parentId);
    const filteredTasks = rootTasks.filter((t) =>
      isWithinInterval(new Date(t.createdAt), interval) ||
      (t.completedAt && isWithinInterval(new Date(t.completedAt), interval)) ||
      (t.status !== 'completed' && t.status !== 'cancelled')
    );

    // Filter sessions within time range
    const filteredSessions = sessions.filter((s) =>
      isWithinInterval(new Date(s.startedAt), interval) ||
      (s.completedAt && isWithinInterval(new Date(s.completedAt), interval)) ||
      (s.status !== 'completed' && s.status !== 'failed' && s.status !== 'stopped')
    );

    // ── Overview Metrics ──
    const completedTasks = filteredTasks.filter((t) => t.status === 'completed').length;
    const inProgressTasks = filteredTasks.filter((t) => t.status === 'in_progress').length;
    const blockedTasks = filteredTasks.filter((t) => t.status === 'blocked').length;
    const todoTasks = filteredTasks.filter((t) => t.status === 'todo').length;
    const inReviewTasks = filteredTasks.filter((t) => t.status === 'in_review').length;
    const cancelledTasks = filteredTasks.filter((t) => t.status === 'cancelled').length;

    // Due date analysis
    const tasksWithDueDate = filteredTasks.filter((t) => t.dueDate);
    const overdueTasks = tasksWithDueDate.filter((t) => {
      if (!t.dueDate || t.status === 'completed' || t.status === 'cancelled') return false;
      return isBefore(parseISO(t.dueDate), startOfDay(now));
    }).length;
    const upcomingDueTasks = tasksWithDueDate.filter((t) => {
      if (!t.dueDate || t.status === 'completed' || t.status === 'cancelled') return false;
      const due = parseISO(t.dueDate);
      return isWithinInterval(due, { start: startOfDay(now), end: endOfDay(subDays(now, -7)) });
    }).length;

    const overview: OverviewMetrics = {
      totalTasks: filteredTasks.length,
      completedTasks,
      inProgressTasks,
      blockedTasks,
      todoTasks,
      inReviewTasks,
      cancelledTasks,
      completionRate: filteredTasks.length > 0 ? Math.round((completedTasks / filteredTasks.length) * 100) : 0,
      totalSessions: filteredSessions.length,
      activeSessions: filteredSessions.filter((s) => s.status === 'working' || s.status === 'idle' || s.status === 'spawning').length,
      completedSessions: filteredSessions.filter((s) => s.status === 'completed').length,
      failedSessions: filteredSessions.filter((s) => s.status === 'failed').length,
      totalTeamMembers: teamMembers.filter((m) => m.status === 'active').length,
      totalTeams: 0, // Will be set by caller if needed
      overdueTasks,
      upcomingDueTasks,
    };

    // ── Daily Data ──
    const days = timeRange.preset === 'all'
      ? eachDayOfInterval({
          start: filteredTasks.length > 0
            ? new Date(Math.min(...filteredTasks.map((t) => t.createdAt), ...filteredSessions.map((s) => s.startedAt)))
            : subDays(now, 30),
          end: now,
        })
      : eachDayOfInterval({ start, end: now < end ? now : end });

    const dailyData: DailyDataPoint[] = days.map((day) => {
      const dayStart = startOfDay(day).getTime();
      const dayEnd = endOfDay(day).getTime();
      return {
        date: format(day, 'yyyy-MM-dd'),
        label: format(day, 'MMM dd'),
        tasksCreated: rootTasks.filter((t) => t.createdAt >= dayStart && t.createdAt <= dayEnd).length,
        tasksCompleted: rootTasks.filter((t) => t.completedAt && t.completedAt >= dayStart && t.completedAt <= dayEnd).length,
        sessionsSpawned: sessions.filter((s) => s.startedAt >= dayStart && s.startedAt <= dayEnd).length,
        sessionsCompleted: sessions.filter((s) => s.completedAt && s.completedAt >= dayStart && s.completedAt <= dayEnd).length,
      };
    });

    // ── Tasks by Status ──
    const tasksByStatus: TasksByStatusData[] = [
      { status: 'Backlog', count: todoTasks, color: STATUS_COLORS.todo },
      { status: 'In Progress', count: inProgressTasks, color: STATUS_COLORS.in_progress },
      { status: 'Review', count: inReviewTasks, color: STATUS_COLORS.in_review },
      { status: 'Completed', count: completedTasks, color: STATUS_COLORS.completed },
      { status: 'Blocked', count: blockedTasks, color: STATUS_COLORS.blocked },
      { status: 'Cancelled', count: cancelledTasks, color: STATUS_COLORS.cancelled },
    ].filter((d) => d.count > 0);

    // ── Tasks by Priority ──
    const tasksByPriority: TasksByPriorityData[] = [
      { priority: 'High', count: filteredTasks.filter((t) => t.priority === 'high').length, color: PRIORITY_COLORS.high },
      { priority: 'Medium', count: filteredTasks.filter((t) => t.priority === 'medium').length, color: PRIORITY_COLORS.medium },
      { priority: 'Low', count: filteredTasks.filter((t) => t.priority === 'low').length, color: PRIORITY_COLORS.low },
    ].filter((d) => d.count > 0);

    // ── Team Member Stats ──
    const teamMemberStats: TeamMemberStat[] = teamMembers
      .filter((m) => m.status === 'active')
      .map((member) => {
        const memberTasks = filteredTasks.filter(
          (t) => t.teamMemberId === member.id || t.teamMemberIds?.includes(member.id)
        );
        const memberSessions = filteredSessions.filter(
          (s) => s.teamMemberId === member.id || s.teamMemberIds?.includes(member.id)
        );
        const assigned = memberTasks.length;
        const completed = memberTasks.filter((t) => t.status === 'completed').length;
        return {
          id: member.id,
          name: member.name,
          avatar: member.avatar,
          role: member.role,
          tasksAssigned: assigned,
          tasksCompleted: completed,
          sessionsRun: memberSessions.length,
          completionRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
        };
      })
      .sort((a, b) => b.tasksAssigned - a.tasksAssigned);

    // ── Calendar Heatmap (last 365 days or time range) ──
    const calendarStart = timeRange.preset === 'all'
      ? startOfDay(subDays(now, 365))
      : start;
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: now });

    const activityByDay = new Map<string, number>();
    for (const task of rootTasks) {
      if (task.completedAt) {
        const key = format(new Date(task.completedAt), 'yyyy-MM-dd');
        activityByDay.set(key, (activityByDay.get(key) ?? 0) + 2); // weight completions
      }
      const createdKey = format(new Date(task.createdAt), 'yyyy-MM-dd');
      activityByDay.set(createdKey, (activityByDay.get(createdKey) ?? 0) + 1);
    }
    for (const session of sessions) {
      const key = format(new Date(session.startedAt), 'yyyy-MM-dd');
      activityByDay.set(key, (activityByDay.get(key) ?? 0) + 1);
    }

    const maxActivity = Math.max(1, ...activityByDay.values());
    const calendarData: CalendarDay[] = calendarDays.map((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const count = activityByDay.get(key) ?? 0;
      const ratio = count / maxActivity;
      const level: 0 | 1 | 2 | 3 | 4 = count === 0 ? 0 : ratio <= 0.25 ? 1 : ratio <= 0.5 ? 2 : ratio <= 0.75 ? 3 : 4;
      return { date: key, count, level };
    });

    // ── Due Date Items ──
    const dueDateItems: DueDateItem[] = filteredTasks
      .filter((t) => t.dueDate && t.status !== 'completed' && t.status !== 'cancelled')
      .map((t) => ({
        taskId: t.id,
        title: t.title,
        dueDate: t.dueDate!,
        status: t.status,
        priority: t.priority,
        projectName: (t as BoardTask).projectName,
        projectColor: (t as BoardTask).projectColor,
        isOverdue: isBefore(parseISO(t.dueDate!), startOfDay(now)),
      }))
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());

    // ── Avg Completion Time ──
    const completedWithTimes = rootTasks.filter((t) => t.completedAt && t.startedAt);
    const avgCompletionTimeMinutes = completedWithTimes.length > 0
      ? Math.round(
          completedWithTimes.reduce(
            (sum, t) => sum + differenceInMinutes(new Date(t.completedAt!), new Date(t.startedAt!)),
            0,
          ) / completedWithTimes.length,
        )
      : null;

    return {
      overview,
      dailyData,
      tasksByStatus,
      tasksByPriority,
      teamMemberStats,
      calendarData,
      dueDateItems,
      avgCompletionTimeMinutes,
    };
  }, [tasks, sessions, teamMembers, timeRange]);
}
