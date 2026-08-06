import { cn } from "@/lib/utils"

export type LogCell = "done" | "partial" | "missed" | "today" | "future"

export type LogRow = {
  goalId: string
  name: string
  cells: LogCell[]
}

export type LogDay = {
  key: string
  label: string
  isToday: boolean
}

/**
 * The week as a log sheet: one row per goal, one column per day.
 *
 * This is the paper habit sheet the app replaces, so it is drawn as marks on
 * a ruled grid rather than as a chart. A filled mark is a day you kept; an
 * open mark is a day you did not. Today is the column ruled in red.
 */
export function WeekLog({ rows, days }: { rows: LogRow[]; days: LogDay[] }) {
  if (rows.length === 0) return null

  return (
    <div>
      <table className="w-full border-separate border-spacing-0 text-left">
        <caption className="sr-only">
          Your goals for each day of this week
        </caption>
        <thead>
          <tr>
            <th scope="col" className="pb-3 text-xs font-normal text-muted-foreground">
              Goal
            </th>
            {days.map((day) => (
              <th
                key={day.key}
                scope="col"
                className={cn(
                  "fig w-11 pb-3 text-center text-[11px] font-normal",
                  day.isToday
                    ? "font-medium text-stamp"
                    : "text-muted-foreground"
                )}
              >
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.goalId}>
              <th
                scope="row"
                className="max-w-0 truncate border-t border-rule py-3 pr-6 text-sm font-normal"
              >
                {row.name}
              </th>
              {row.cells.map((cell, index) => (
                <td
                  key={days[index]?.key ?? index}
                  className={cn(
                    "border-t border-rule py-3 text-center align-middle",
                    days[index]?.isToday && "bg-stamp/8"
                  )}
                >
                  <Mark
                    state={cell}
                    day={days[index]?.label ?? ""}
                    name={row.name}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="fig mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule pt-3 text-[11px] text-muted-foreground">
        <LegendItem state="done" label="kept" />
        <LegendItem state="partial" label="partly" />
        <LegendItem state="missed" label="missed" />
        <LegendItem state="today" label="today" />
        <LegendItem state="future" label="ahead" />
      </div>
    </div>
  )
}

function LegendItem({ state, label }: { state: LogCell; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={markClass(state)} />
      {label}
    </span>
  )
}

const MARK_LABEL: Record<LogCell, string> = {
  done: "kept",
  partial: "partly kept",
  missed: "missed",
  today: "still open today",
  future: "upcoming",
}

function markClass(state: LogCell) {
  return cn(
    "block h-[18px] w-[18px] shrink-0 rounded-[2px]",
    state === "done" && "bg-foreground",
    state === "partial" && "border border-foreground/60 bg-foreground/30",
    state === "missed" && "border border-rule",
    state === "today" && "border-[1.5px] border-stamp",
    state === "future" && "border border-dashed border-rule"
  )
}

function Mark({
  state,
  day,
  name,
}: {
  state: LogCell
  day: string
  name: string
}) {
  const label = `${name}, ${day}: ${MARK_LABEL[state]}`

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(markClass(state), "mx-auto")}
    />
  )
}
