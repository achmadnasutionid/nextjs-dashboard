"use client"

import * as React from "react"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "./button"
import { Skeleton } from "./skeleton"
import { cn } from "@/lib/utils"

interface CalendarEvent {
  id: string
  type: "quotation" | "paragon" | "erha"
  referenceId: string
  productionDate: string
  totalAmount: number
  billTo: string
  displayTitle: string
  projectName?: string
}

export function FloatingCalendar() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [currentDate, setCurrentDate] = React.useState(new Date())
  const [events, setEvents] = React.useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const calendarRef = React.useRef<HTMLDivElement>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Fetch events when month changes or calendar opens
  React.useEffect(() => {
    if (isOpen) {
      fetchEvents()
    }
  }, [isOpen, year, month])

  // Close calendar when clicking outside
  React.useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const fetchEvents = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/calendar-events?year=${year}&month=${month + 1}`
      )
      if (response.ok) {
        const data = await response.json()
        setEvents(data)
      }
    } catch (error) {
      console.error("Error fetching calendar events:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
  }

  const getEventsForDate = (day: number) => {
    return events.filter(event => {
      const eventDate = new Date(event.productionDate)
      return (
        eventDate.getFullYear() === year &&
        eventDate.getMonth() === month &&
        eventDate.getDate() === day
      )
    })
  }

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  // Generate calendar days
  const calendarDays = []
  
  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push({ day: null, isCurrentMonth: false })
  }
  
  // Actual days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({ day, isCurrentMonth: true })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amount))
  }

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "quotation":
        return "bg-primary"
      case "paragon":
        return "bg-warning"
      case "erha":
        return "bg-info"
      default:
        return "bg-primary"
    }
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 left-6 z-50",
          "h-14 w-14 rounded-full",
          "bg-primary text-primary-foreground shadow-lg",
          "hover:bg-primary/90 transition-all duration-200",
          "flex items-center justify-center",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          isOpen && "scale-95"
        )}
        aria-label="Toggle Calendar"
      >
        <Calendar className="h-6 w-6" />
      </button>

      {/* Calendar Modal */}
      {isOpen && (
        <div
          ref={calendarRef}
          className={cn(
            "fixed bottom-24 left-6 z-50",
            "w-[400px] rounded-lg shadow-2xl",
            "bg-card border border-border",
            "animate-in slide-in-from-bottom-5 duration-200"
          )}
        >
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Calendar</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={handleToday}
              >
                Today
              </Button>
            </div>
            
            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={handlePreviousMonth}
                className="p-2 rounded-md hover:bg-accent transition-colors"
                aria-label="Previous Month"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="font-semibold text-base">
                {monthNames[month]} {year}
              </div>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-md hover:bg-accent transition-colors"
                aria-label="Next Month"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Calendar Body */}
          <div className="p-4">
            {isLoading ? (
              <>
                {/* Day Names Skeleton */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {dayNames.map(dayName => (
                    <div
                      key={dayName}
                      className="text-center text-xs font-medium text-muted-foreground py-1"
                    >
                      {dayName}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid Skeleton */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 35 }).map((_, index) => (
                    <div key={index} className="aspect-square">
                      <Skeleton className="h-full w-full rounded-md" />
                    </div>
                  ))}
                </div>

                {/* Legend Skeleton */}
                <div className="mt-4 pt-4 border-t border-border">
                  <Skeleton className="h-3 w-12 mb-2" />
                  <div className="flex flex-wrap gap-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Day Names */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {dayNames.map(dayName => (
                    <div
                      key={dayName}
                      className="text-center text-xs font-medium text-muted-foreground py-1"
                    >
                      {dayName}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((item, index) => {
                    if (!item.day) {
                      return <div key={`empty-${index}`} className="aspect-square" />
                    }

                    const dayEvents = getEventsForDate(item.day)
                    const isToday = isCurrentMonth && today.getDate() === item.day
                    const hasEvents = dayEvents.length > 0

                    return (
                      <div
                        key={`day-${item.day}`}
                        className="relative group"
                      >
                        <div
                          className={cn(
                            "aspect-square rounded-md flex flex-col items-center justify-center",
                            "text-sm transition-colors relative",
                            isToday && "bg-primary text-primary-foreground font-bold",
                            !isToday && "hover:bg-accent",
                            hasEvents && !isToday && "font-semibold"
                          )}
                        >
                          <span>{item.day}</span>
                          {hasEvents && (
                            <div className="flex gap-0.5 mt-0.5">
                              {dayEvents.slice(0, 3).map((event, idx) => (
                                <div
                                  key={idx}
                                  className={cn(
                                    "w-1 h-1 rounded-full",
                                    getEventTypeColor(event.type)
                                  )}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Tooltip - Shows on hover */}
                        {hasEvents && (
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                            <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[250px] max-w-[300px]">
                              <div className="text-xs font-semibold mb-2 text-foreground">
                                {dayEvents.length} Event{dayEvents.length > 1 ? "s" : ""}
                              </div>
                              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {dayEvents.map((event, idx) => (
                                  <div
                                    key={idx}
                                    className="text-xs border-l-2 pl-2 py-1"
                                    style={{
                                      borderColor: getEventTypeColor(event.type).replace("bg-", "var(--color-")  + ")"
                                    }}
                                  >
                                    <div className="font-medium text-foreground">
                                      {event.displayTitle}
                                    </div>
                                    <div className="text-muted-foreground">
                                      {event.referenceId}
                                    </div>
                                    <div className="text-muted-foreground">
                                      {formatCurrency(event.totalAmount)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-xs text-muted-foreground mb-2">Legend:</div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span>Quotation</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-warning" />
                      <span>Paragon</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-info" />
                      <span>Erha</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
