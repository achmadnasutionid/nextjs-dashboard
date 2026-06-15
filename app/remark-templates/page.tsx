"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Footer } from "@/components/layout/footer"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { FileText, Edit, Trash2, Plus, Loader2, GripVertical, RefreshCw } from "lucide-react"
import { CardSkeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { toast } from "sonner"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface RemarkTemplate {
  id: string
  name: string
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  items: { id: string; text: string; order: number }[]
}

interface EditableItem {
  id: string
  text: string
}

function SortableItem({
  item,
  onUpdate,
  onRemove,
}: {
  item: EditableItem
  onUpdate: (text: string) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-start gap-2 mb-2"
    >
      <button
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <Textarea
        value={item.text}
        onChange={(e) => onUpdate(e.target.value)}
        className="flex-1 min-h-[60px] resize-none"
        placeholder="Remark text"
        rows={2}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-8 w-8 p-0 shrink-0"
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  )
}

export default function RemarkTemplatesPage() {
  const [templates, setTemplates] = useState<RemarkTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<RemarkTemplate | null>(null)

  const [formName, setFormName] = useState("")
  const [formItems, setFormItems] = useState<EditableItem[]>([])
  const [nameError, setNameError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/remark-templates", { cache: "no-store" })
      if (res.ok) setTemplates(await res.json())
    } catch (error) {
      console.error("Error fetching remark templates:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchTemplates()
    setIsRefreshing(false)
    toast.success("Refreshed")
  }

  const resetForm = () => {
    setFormName("")
    setFormItems([])
    setNameError("")
    setSelectedTemplate(null)
  }

  const addItem = () =>
    setFormItems([...formItems, { id: crypto.randomUUID(), text: "" }])

  const updateItem = (id: string, text: string) =>
    setFormItems(formItems.map((i) => (i.id === id ? { ...i, text } : i)))

  const removeItem = (id: string) =>
    setFormItems(formItems.filter((i) => i.id !== id))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = formItems.findIndex((i) => i.id === active.id)
      const newIndex = formItems.findIndex((i) => i.id === over.id)
      setFormItems(arrayMove(formItems, oldIndex, newIndex))
    }
  }

  const handleCreate = async () => {
    if (!formName.trim()) {
      setNameError("Name is required")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/remark-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          items: formItems.map((i) => i.text).filter(Boolean),
        }),
      })
      if (res.ok) {
        await fetchTemplates()
        setIsCreateOpen(false)
        resetForm()
        toast.success("Template created")
      } else {
        const err = await res.json()
        setNameError(err.error || "Failed to create template")
        toast.error(err.error || "Failed to create template")
      }
    } catch {
      toast.error("Failed to create template")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (template: RemarkTemplate) => {
    setSelectedTemplate(template)
    setFormName(template.name)
    setFormItems(
      template.items.map((i) => ({ id: crypto.randomUUID(), text: i.text }))
    )
    setNameError("")
    setIsEditOpen(true)
  }

  const handleUpdate = async () => {
    if (!formName.trim()) {
      setNameError("Name is required")
      return
    }
    if (!selectedTemplate) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/remark-templates/${selectedTemplate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          items: formItems.map((i) => i.text).filter(Boolean),
        }),
      })
      if (res.ok) {
        await fetchTemplates()
        setIsEditOpen(false)
        resetForm()
        toast.success("Template updated")
      } else {
        const err = await res.json()
        setNameError(err.error || "Failed to update template")
        toast.error(err.error || "Failed to update template")
      }
    } catch {
      toast.error("Failed to update template")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteClick = (template: RemarkTemplate) => {
    setSelectedTemplate(template)
    setIsDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedTemplate || isDeleting) return
    const prev = [...templates]
    setTemplates(templates.filter((t) => t.id !== selectedTemplate.id))
    setIsDeleteOpen(false)
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/remark-templates/${selectedTemplate.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success(`"${selectedTemplate.name}" deleted`)
      } else {
        setTemplates(prev)
        toast.error("Failed to delete template")
      }
    } catch {
      setTemplates(prev)
      toast.error("Failed to delete template")
    } finally {
      setIsDeleting(false)
      setSelectedTemplate(null)
    }
  }

  const formBody = (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="template-name">Name <span className="text-destructive">*</span></Label>
        <Input
          id="template-name"
          value={formName}
          onChange={(e) => {
            setFormName(e.target.value)
            if (nameError) setNameError("")
          }}
          placeholder="e.g. Default, Paragon & Barclay"
        />
        {nameError && <p className="text-sm text-destructive">{nameError}</p>}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Items</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 gap-1">
            <Plus className="h-3 w-3" />
            Add Item
          </Button>
        </div>
        <div className="max-h-[480px] overflow-y-auto pr-1">
          {formItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No items yet. Add some remark items above.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={formItems.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {formItems.map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    onUpdate={(text) => updateItem(item.id, text)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Remark Templates" showBackButton backTo="/" />

      <main className="flex flex-1 flex-col bg-gradient-to-br from-background via-background to-muted px-4 py-12">
        <div className="container mx-auto max-w-7xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Remark Templates</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Template
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
            </div>
          ) : templates.length === 0 ? (
            <EmptyState
              type="templates"
              actionLabel="Create Template"
              onAction={() => setIsCreateOpen(true)}
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <Card key={template.id} className="flex flex-col transition-all hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{template.items.length} item{template.items.length !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col space-y-3">
                    <div className="flex-1 space-y-1 text-sm">
                      {template.items.slice(0, 4).map((item) => (
                        <p key={item.id} className="text-muted-foreground truncate">
                          {item.text || <span className="italic">empty</span>}
                        </p>
                      ))}
                      {template.items.length > 4 && (
                        <p className="text-muted-foreground text-xs">+{template.items.length - 4} more...</p>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => handleEdit(template)}
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleDeleteClick(template)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsCreateOpen(open) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Remark Template</DialogTitle>
          </DialogHeader>
          {formBody}
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setIsCreateOpen(false) }} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsEditOpen(open) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Remark Template</DialogTitle>
          </DialogHeader>
          {formBody}
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setIsEditOpen(false) }} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={(open) => !isDeleting && setIsDeleteOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete <strong>{selectedTemplate?.name}</strong> and its {selectedTemplate?.items.length} item{selectedTemplate?.items.length !== 1 ? "s" : ""}. Existing quotations and invoices are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
