"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
  type DropAnimation,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { toast } from "sonner"
import { updateGoalOrderAction } from "@/app/actions/goals"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckInButton } from "@/components/check-in-button"
import { TinyHeatmap } from "@/components/tiny-heatmap"
import { Sparkline } from "@/components/sparkline"

interface GoalData {
  goal: {
    id: string
    name: string
    cadenceType: "DAILY" | "WEEKLY"
    weeklyTarget: number | null
  }
  todayDone: boolean
  todayPartial: boolean
  todayCount: number
  dailyTarget: number
  checkInsThisWeek: { id: string }[]
  consistency: number
  weekTarget: number
  weekProgress: number
  counts: number[]
  sparkValues: number[]
  hasMultiTarget: boolean
}

// Custom drop animation for smooth finish
const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.5",
      },
    },
  }),
}

// Static card content - shared between sortable and overlay
function GoalCardContent({ 
  data, 
  isDragging = false,
  isOverlay = false,
}: { 
  data: GoalData
  isDragging?: boolean
  isOverlay?: boolean
}) {
  const { goal, todayDone, todayPartial, todayCount, dailyTarget, checkInsThisWeek, consistency, weekTarget, weekProgress, counts, sparkValues, hasMultiTarget } = data

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-shadow",
        todayDone && !todayPartial ? "border-emerald-500/30 bg-emerald-500/5" : "",
        isDragging && "opacity-50",
        isOverlay && "shadow-2xl ring-2 ring-primary/20 cursor-grabbing"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <div className={cn(
              "cursor-grab active:cursor-grabbing touch-none",
              isOverlay ? "cursor-grabbing" : ""
            )}>
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                todayDone 
                  ? todayPartial 
                    ? "bg-amber-500" 
                    : "bg-emerald-500" 
                  : todayCount > 0
                    ? "bg-amber-500"
                    : "border-2 border-muted-foreground/30"
              }`}
            />
            <Link 
              href={`/goals/${goal.id}`} 
              className="font-medium hover:underline"
              onClick={(e) => isOverlay && e.preventDefault()}
            >
              {goal.name}
            </Link>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {consistency}%
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground pl-6">
            <span>
              {goal.cadenceType === "DAILY"
                ? hasMultiTarget 
                  ? `${dailyTarget}x/day`
                  : "Daily"
                : `${goal.weeklyTarget}x/week`}
            </span>
            <span>•</span>
            {hasMultiTarget && goal.cadenceType === "DAILY" && (
              <>
                <span className={todayCount >= dailyTarget ? "text-emerald-600" : ""}>
                  {todayCount}/{dailyTarget} today
                </span>
                <span>•</span>
              </>
            )}
            <span>{checkInsThisWeek.length}/{weekTarget} this week</span>
          </div>
        </div>
        {!isOverlay && (
          <CheckInButton
            goalId={goal.id}
            completed={todayDone}
            todayCount={todayCount}
            dailyTarget={dailyTarget}
          />
        )}
      </div>
      
      <div className="mt-3 space-y-2">
        <Progress value={weekProgress} className="h-1.5" />
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <TinyHeatmap counts={counts} />
          </div>
          <div className="flex items-center gap-2">
            <Sparkline values={sparkValues} />
          </div>
        </div>
      </div>
    </div>
  )
}

function SortableGoalCard({ data }: { data: GoalData }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: data.goal.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms cubic-bezier(0.25, 1, 0.5, 1)",
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="touch-none"
    >
      <GoalCardContent data={data} isDragging={isDragging} />
    </div>
  )
}

interface DraggableDashboardGoalsProps {
  goals: GoalData[]
}

export function DraggableDashboardGoals({ goals }: DraggableDashboardGoalsProps) {
  const [items, setItems] = useState(goals)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Sync state when props change (e.g., after server revalidation)
  useEffect(() => {
    setItems(goals)
  }, [goals])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Reduced for snappier feel
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(item => item.goal.id === active.id)
      const newIndex = items.findIndex(item => item.goal.id === over.id)
      const newItems = arrayMove(items, oldIndex, newIndex)
      
      setItems(newItems)
      
      const result = await updateGoalOrderAction(newItems.map(item => item.goal.id))
      
      if (!result.ok) {
        setItems(items)
        toast.error(result.error ?? "Could not save order")
      }
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  const activeItem = activeId ? items.find(item => item.goal.id === activeId) : null

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No goals yet.{" "}
          <Link href="/goals" className="text-primary font-medium hover:underline">
            Create your first goal
          </Link>{" "}
          to start tracking.
        </p>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
    >
      <SortableContext 
        items={items.map(item => item.goal.id)} 
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {items.map((data) => (
            <SortableGoalCard key={data.goal.id} data={data} />
          ))}
        </div>
      </SortableContext>
      
      <DragOverlay dropAnimation={dropAnimation}>
        {activeItem ? (
          <GoalCardContent data={activeItem} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
