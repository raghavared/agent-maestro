import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO, getDay, startOfWeek, differenceInWeeks, addDays } from 'date-fns';
import type { BoardTask } from '../../hooks/useMultiProjectTasks';
import type { MaestroSession, TeamMember } from '../../app/types/maestro';
import {
  useDashboardData,
  getTimeRange,
  type TimeRangePreset,
  type TimeRange,
  type CalendarDay,
  type DueDateItem,
  type TeamMemberStat,
} from '../../hooks/useDashboardData';

// ── Types ──

interface DashboardProps {
  tasks: BoardTask[];
  sessions: MaestroSession[];
  teamMembers: TeamMember[];
  isMultiProject: boolean;
}

// ── Custom Tooltip ──

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dashTooltip">
      <div className="dashTooltipLabel">{label}</div>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="dashTooltipRow">
          <span className="dashTooltipDot" style={{ background: entry.color }} />
          <span className="dashTooltipName">{entry.name}</span>
          <span className="dashTooltipValue">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Metric Card ──

function MetricCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  icon?: string;
}) {
  return (
    <div className="dashMetricCard" style={{ borderColor: accent ?? 'rgba(var(--theme-primary-rgb), 0.1)' }}>
      <div className="dashMetricCardHeader">
        {icon && <span className="dashMetricCardIcon">{icon}</span>}
        <span className="dashMetricCardLabel">{label}</span>
      </div>
      <div className="dashMetricCardValue" style={{ color: accent }}>
        {value}
      </div>
      {sub && <div className="dashMetricCardSub">{sub}</div>}
    </div>
  );
}

// ── Calendar Heatmap ──

function CalendarHeatmap({ data }: { data: CalendarDay[] }) {
  if (data.length === 0) return null;

  const CELL_SIZE = 12;
  const GAP = 2;
  const DAYS_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  // Group by weeks
  const firstDate = parseISO(data[0].date);
  const weeks: (CalendarDay | null)[][] = [];
  let currentWeek: (CalendarDay | null)[] = [];

  // Pad the first week
  const startDow = getDay(firstDate); // 0=Sun
  for (let i = 0; i < startDow; i++) currentWeek.push(null);

  for (const day of data) {
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(day);
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  const LEVEL_COLORS = [
    'rgba(var(--theme-primary-rgb), 0.04)',
    'rgba(var(--theme-primary-rgb), 0.15)',
    'rgba(var(--theme-primary-rgb), 0.3)',
    'rgba(var(--theme-primary-rgb), 0.5)',
    'var(--theme-primary)',
  ];

  const width = weeks.length * (CELL_SIZE + GAP) + 30;
  const height = 7 * (CELL_SIZE + GAP) + 20;

  // Month labels
  const monthLabels: { text: string; x: number }[] = [];
  let lastMonth = '';
  weeks.forEach((week, wi) => {
    for (const day of week) {
      if (day) {
        const month = format(parseISO(day.date), 'MMM');
        if (month !== lastMonth) {
          monthLabels.push({ text: month, x: wi * (CELL_SIZE + GAP) + 30 });
          lastMonth = month;
        }
        break;
      }
    }
  });

  return (
    <div className="dashCalendarWrap">
      <svg width={width} height={height} className="dashCalendarSvg">
        {/* Month labels */}
        {monthLabels.map((m, i) => (
          <text key={i} x={m.x} y={10} className="dashCalendarMonth">
            {m.text}
          </text>
        ))}
        {/* Day labels */}
        {DAYS_LABELS.map((label, i) => (
          <text key={i} x={0} y={20 + i * (CELL_SIZE + GAP) + CELL_SIZE / 2 + 3} className="dashCalendarDayLabel">
            {label}
          </text>
        ))}
        {/* Cells */}
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (!day) return null;
            return (
              <rect
                key={`${wi}-${di}`}
                x={wi * (CELL_SIZE + GAP) + 30}
                y={di * (CELL_SIZE + GAP) + 16}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2}
                fill={LEVEL_COLORS[day.level]}
                className="dashCalendarCell"
              >
                <title>{`${day.date}: ${day.count} activities`}</title>
              </rect>
            );
          }),
        )}
      </svg>
    </div>
  );
}

// ── Due Date List ──

function DueDateList({ items }: { items: DueDateItem[] }) {
  if (items.length === 0) {
    return <div className="dashEmptyState">No upcoming deadlines</div>;
  }
  return (
    <div className="dashDueList">
      {items.slice(0, 10).map((item) => (
        <div key={item.taskId} className={`dashDueItem ${item.isOverdue ? 'dashDueItem--overdue' : ''}`}>
          <div className="dashDueItemLeft">
            <span className={`dashDuePriority dashDuePriority--${item.priority}`} />
            <span className="dashDueTitle">{item.title}</span>
          </div>
          <div className="dashDueItemRight">
            {item.projectName && (
              <span className="dashDueProject" style={{ color: item.projectColor }}>
                {item.projectName}
              </span>
            )}
            <span className={`dashDueDate ${item.isOverdue ? 'dashDueDate--overdue' : ''}`}>
              {item.isOverdue ? 'Overdue: ' : ''}{format(parseISO(item.dueDate), 'MMM dd')}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Team Member Stats Table ──

function TeamMemberStatsView({ stats }: { stats: TeamMemberStat[] }) {
  if (stats.length === 0) {
    return <div className="dashEmptyState">No team members configured</div>;
  }
  return (
    <div className="dashTeamGrid">
      {stats.map((member) => (
        <div key={member.id} className="dashTeamCard">
          <div className="dashTeamCardHeader">
            <span className="dashTeamAvatar">{member.avatar}</span>
            <div className="dashTeamInfo">
              <span className="dashTeamName">{member.name}</span>
              <span className="dashTeamRole">{member.role}</span>
            </div>
          </div>
          <div className="dashTeamMetrics">
            <div className="dashTeamMetric">
              <span className="dashTeamMetricValue">{member.tasksAssigned}</span>
              <span className="dashTeamMetricLabel">Assigned</span>
            </div>
            <div className="dashTeamMetric">
              <span className="dashTeamMetricValue" style={{ color: '#4ade80' }}>{member.tasksCompleted}</span>
              <span className="dashTeamMetricLabel">Done</span>
            </div>
            <div className="dashTeamMetric">
              <span className="dashTeamMetricValue" style={{ color: '#00d9ff' }}>{member.sessionsRun}</span>
              <span className="dashTeamMetricLabel">Sessions</span>
            </div>
            <div className="dashTeamMetric">
              <span className="dashTeamMetricValue" style={{ color: member.completionRate >= 70 ? '#4ade80' : member.completionRate >= 40 ? '#ffb000' : '#ef4444' }}>
                {member.completionRate}%
              </span>
              <span className="dashTeamMetricLabel">Rate</span>
            </div>
          </div>
          {/* Mini progress bar */}
          <div className="dashTeamProgressBar">
            <div
              className="dashTeamProgressFill"
              style={{ width: `${member.completionRate}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Format time duration ──

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Main Dashboard Component ──

export const Dashboard = React.memo(function Dashboard({
  tasks,
  sessions,
  teamMembers,
  isMultiProject,
}: DashboardProps) {
  const [preset, setPreset] = useState<TimeRangePreset>('30d');
  const timeRange = useMemo(() => getTimeRange(preset), [preset]);
  const data = useDashboardData(tasks, sessions, teamMembers, timeRange);

  const presets: { value: TimeRangePreset; label: string }[] = [
    { value: '7d', label: '7D' },
    { value: '14d', label: '14D' },
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
    { value: '6m', label: '6M' },
    { value: '1y', label: '1Y' },
    { value: 'all', label: 'All' },
  ];

  // Compute tick interval for X axis based on data length
  const xAxisInterval = data.dailyData.length > 60 ? Math.floor(data.dailyData.length / 10)
    : data.dailyData.length > 30 ? 4
    : data.dailyData.length > 14 ? 2
    : 0;

  return (
    <div className="dashContainer">
      {/* Time Range Selector */}
      <div className="dashTimeBar">
        <span className="dashTimeLabel">Time Range</span>
        <div className="dashTimePresets">
          {presets.map((p) => (
            <button
              key={p.value}
              className={`dashTimeBtn ${preset === p.value ? 'dashTimeBtn--active' : ''}`}
              onClick={() => setPreset(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="dashSection">
        <div className="dashMetricsGrid">
          <MetricCard label="Total Tasks" value={data.overview.totalTasks} icon="&#x229E;" accent="var(--theme-primary)" />
          <MetricCard label="Completed" value={data.overview.completedTasks} icon="&#x2713;" accent="#4ade80" sub={`${data.overview.completionRate}% rate`} />
          <MetricCard label="In Progress" value={data.overview.inProgressTasks} icon="&#x25C9;" accent="#00d9ff" />
          <MetricCard label="Blocked" value={data.overview.blockedTasks} icon="&#x2717;" accent="#ef4444" />
          <MetricCard label="Sessions" value={data.overview.totalSessions} icon="&#x25C8;" accent="#a78bfa" sub={`${data.overview.activeSessions} active`} />
          <MetricCard label="Team Members" value={data.overview.totalTeamMembers} icon="&#x2638;" accent="#f472b6" />
          {data.overview.overdueTasks > 0 && (
            <MetricCard label="Overdue" value={data.overview.overdueTasks} icon="&#x23F0;" accent="#ef4444" />
          )}
          {data.avgCompletionTimeMinutes !== null && (
            <MetricCard label="Avg Completion" value={formatDuration(data.avgCompletionTimeMinutes)} icon="&#x23F1;" accent="#ffb000" />
          )}
        </div>
      </div>

      {/* Task Activity Over Time */}
      <div className="dashSection">
        <div className="dashSectionHeader">
          <h3 className="dashSectionTitle">Task Activity</h3>
        </div>
        <div className="dashChartWrap">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.dailyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d9ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d9ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--theme-primary-rgb), 0.06)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'rgba(var(--theme-primary-rgb), 0.3)' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(var(--theme-primary-rgb), 0.08)' }}
                interval={xAxisInterval}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'rgba(var(--theme-primary-rgb), 0.3)' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="tasksCreated" name="Created" stroke="#00d9ff" fill="url(#gradCreated)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="tasksCompleted" name="Completed" stroke="#4ade80" fill="url(#gradCompleted)" strokeWidth={2} dot={false} />
              <Legend
                verticalAlign="top"
                align="right"
                height={30}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: 'rgba(var(--theme-primary-rgb), 0.5)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Column: Tasks by Status + Priority */}
      <div className="dashRow">
        <div className="dashSection dashSection--half">
          <div className="dashSectionHeader">
            <h3 className="dashSectionTitle">Tasks by Status</h3>
          </div>
          <div className="dashChartWrap">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.tasksByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="count"
                  nameKey="status"
                  stroke="none"
                  paddingAngle={2}
                >
                  {data.tasksByStatus.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: 'rgba(var(--theme-primary-rgb), 0.5)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashSection dashSection--half">
          <div className="dashSectionHeader">
            <h3 className="dashSectionTitle">Tasks by Priority</h3>
          </div>
          <div className="dashChartWrap">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.tasksByPriority} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--theme-primary-rgb), 0.06)" />
                <XAxis
                  dataKey="priority"
                  tick={{ fontSize: 11, fill: 'rgba(var(--theme-primary-rgb), 0.4)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(var(--theme-primary-rgb), 0.08)' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'rgba(var(--theme-primary-rgb), 0.3)' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Tasks" radius={[4, 4, 0, 0]}>
                  {data.tasksByPriority.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Session Activity */}
      <div className="dashSection">
        <div className="dashSectionHeader">
          <h3 className="dashSectionTitle">Session Activity</h3>
        </div>
        <div className="dashChartWrap">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.dailyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--theme-primary-rgb), 0.06)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'rgba(var(--theme-primary-rgb), 0.3)' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(var(--theme-primary-rgb), 0.08)' }}
                interval={xAxisInterval}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'rgba(var(--theme-primary-rgb), 0.3)' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="sessionsSpawned" name="Spawned" fill="#a78bfa" radius={[3, 3, 0, 0]} />
              <Bar dataKey="sessionsCompleted" name="Completed" fill="#4ade80" radius={[3, 3, 0, 0]} />
              <Legend
                verticalAlign="top"
                align="right"
                height={30}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: 'rgba(var(--theme-primary-rgb), 0.5)' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Column: Due Dates + Calendar */}
      <div className="dashRow">
        <div className="dashSection dashSection--half">
          <div className="dashSectionHeader">
            <h3 className="dashSectionTitle">Upcoming Deadlines</h3>
          </div>
          <DueDateList items={data.dueDateItems} />
        </div>

        <div className="dashSection dashSection--half">
          <div className="dashSectionHeader">
            <h3 className="dashSectionTitle">Activity Heatmap</h3>
          </div>
          <CalendarHeatmap data={data.calendarData} />
        </div>
      </div>

      {/* Team Member Stats */}
      {teamMembers.length > 0 && (
        <div className="dashSection">
          <div className="dashSectionHeader">
            <h3 className="dashSectionTitle">Team Members</h3>
          </div>
          <TeamMemberStatsView stats={data.teamMemberStats} />
        </div>
      )}
    </div>
  );
});
