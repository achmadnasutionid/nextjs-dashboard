"use client"

import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface TemplateItem {
  id: string
  text: string
  order: number
}

interface Template {
  id: string
  name: string
  items: TemplateItem[]
}

interface Remark {
  id: string
  text: string
  isCompleted: boolean
}

interface RemarkTemplateSelectorProps {
  templates: Template[]
  remarks: Remark[]
  baselineTexts: string[]
  onLoad: (items: Remark[], templateId: string, texts: string[]) => void
}

export function RemarkTemplateSelector({
  templates,
  remarks,
  baselineTexts,
  onLoad,
}: RemarkTemplateSelectorProps) {
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [selectKey, setSelectKey] = useState(0)

  const isDirty = () => {
    const currentTexts = remarks.map((r) => r.text)
    if (currentTexts.length !== baselineTexts.length) return true
    return currentTexts.some((t, i) => t !== baselineTexts[i])
  }

  const applyTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId)
    if (!template) return
    const sorted = [...template.items].sort((a, b) => a.order - b.order)
    const items: Remark[] = sorted.map((item) => ({
      id: crypto.randomUUID(),
      text: item.text,
      isCompleted: false,
    }))
    const texts = sorted.map((i) => i.text)
    onLoad(items, templateId, texts)
    setSelectKey((k) => k + 1)
  }

  const handleSelect = (templateId: string) => {
    if (isDirty()) {
      setPendingTemplateId(templateId)
      setShowConfirm(true)
    } else {
      applyTemplate(templateId)
    }
  }

  const handleConfirm = () => {
    if (pendingTemplateId) applyTemplate(pendingTemplateId)
    setShowConfirm(false)
    setPendingTemplateId(null)
  }

  const handleCancel = () => {
    setShowConfirm(false)
    setPendingTemplateId(null)
    setSelectKey((k) => k + 1)
  }

  if (templates.length === 0) return null

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Load template:</span>
        <Select key={selectKey} onValueChange={handleSelect}>
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue placeholder="Select template" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace remarks?</AlertDialogTitle>
            <AlertDialogDescription>
              Your remarks have been modified. Loading a new template will replace all current remarks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Load Template</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
