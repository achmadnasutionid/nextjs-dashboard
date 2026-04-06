"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Edit2, Check, GripVertical, Percent } from "lucide-react"
import { AdjustByPercentageModal } from "@/components/ui/adjust-by-percentage-modal"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface SummaryItem {
  id: string
  label: string
  value: string
  note?: string
}

/** When set, a line is shown before total: "Price adjusted by X%." or "Price adjusted by X% because (notes)." */
export interface AdjustmentInfo {
  percentage: number
  notes?: string
}

interface ReorderableSummaryProps {
  items: SummaryItem[]
  onReorder: (newOrder: string[]) => void
  /** When provided, shows an "Adjust by %" button that opens a modal to scale all line item amounts by a percentage. */
  onAdjustByPercentage?: (percentage: number, notes?: string) => void
  /** Saved adjustment to display before total. When set, shows "Price adjusted by X%." or "Price adjusted by X% because (notes)." */
  adjustment?: AdjustmentInfo | null
}

function isZeroMoneyValue(value: string) {
  const digits = value.replace(/[^\d-]/g, "")
  if (!digits) return false
  const n = Number.parseInt(digits, 10)
  return Number.isFinite(n) && n === 0
}

function SortableSummaryItem({ item }: { item: SummaryItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-card p-3"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex flex-1 items-center justify-between">
        <div>
          <div className="font-medium">{item.label}</div>
          {item.note && (
            <div className="text-xs text-muted-foreground mt-1">{item.note}</div>
          )}
        </div>
        <div className="font-semibold">{item.value}</div>
      </div>
    </div>
  )
}

export function ReorderableSummary({ items, onReorder, onAdjustByPercentage, adjustment }: ReorderableSummaryProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [sortedItems, setSortedItems] = useState(items)
  const containerRef = useRef<HTMLDivElement>(null)
  const visibleItems = sortedItems.filter((item) => !(item.id === "pph" && isZeroMoneyValue(item.value)))

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    setSortedItems(items)
  }, [items])

  // Click outside handler
  useEffect(() => {
    if (!isEditing) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleSave()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isEditing, sortedItems])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setSortedItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleSave = () => {
    setIsEditing(false)
    onReorder(sortedItems.map(item => item.id))
  }

  const handleToggleEdit = () => {
    if (isEditing) {
      handleSave()
    } else {
      setIsEditing(true)
    }
  }

  return (
    <div ref={containerRef} className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Summary</h3>
        <div className="flex items-center gap-1">
          {onAdjustByPercentage != null && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowAdjustModal(true)}
              title="Adjust all amounts by percentage"
            >
              <Percent className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleToggleEdit}
          >
            {isEditing ? (
              <Check className="h-4 w-4" />
            ) : (
              <Edit2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      {onAdjustByPercentage != null && (
        <AdjustByPercentageModal
          open={showAdjustModal}
          onOpenChange={setShowAdjustModal}
          onConfirm={onAdjustByPercentage}
          initialPercentage={adjustment?.percentage}
          initialNotes={adjustment?.notes}
        />
      )}

      {isEditing ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {visibleItems.map((item) => (
                <SortableSummaryItem key={item.id} item={item} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((item, index) => (
            <div key={item.id}>
              {/* Show adjustment note before total (item with id 'total') */}
              {item.id === "total" && adjustment != null && (
                <div className="text-xs text-muted-foreground mb-1">
                  {adjustment.notes?.trim()
                    ? `Price adjusted by ${adjustment.percentage > 0 ? "+" : ""}${adjustment.percentage}% because ${adjustment.notes.trim()}.`
                    : `Price adjusted by ${adjustment.percentage > 0 ? "+" : ""}${adjustment.percentage}%.`}
                </div>
              )}
              {index === 2 && (
                <div className="border-t pt-2 mb-2" />
              )}
              <div className={`flex justify-between ${index === 2 ? 'text-base font-bold' : 'text-sm'}`}>
                <div>
                  <span>{item.label}:</span>
                  {item.note && (
                    <div className="text-xs font-bold mt-1 text-muted-foreground">
                      {item.note}
                    </div>
                  )}
                </div>
                <span className={`font-medium ${index === 2 ? 'text-primary' : item.id === 'pph' ? 'text-green-600' : ''}`}>
                  {item.id === 'pph' && '+ '}{item.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
