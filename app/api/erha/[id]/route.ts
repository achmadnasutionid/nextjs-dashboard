import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { invalidateErhaCaches } from "@/lib/cache-invalidation"
import { generateUniqueName } from "@/lib/name-validator"
import { syncTracker, updateTrackerName } from "@/lib/tracker-sync"
import { safeParseFloat } from "@/lib/number-validator"

// GET single erha ticket
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ticket = await prisma.erhaTicket.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            details: true
          }
        },
        remarks: {
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: "Erha ticket not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(ticket)
  } catch (error) {
    console.error("Error fetching erha ticket:", error)
    return NextResponse.json(
      { error: "Failed to fetch erha ticket" },
      { status: 500 }
    )
  }
}

// PUT update erha ticket
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // If only status is provided, just update the status
    if (body.status && Object.keys(body).length === 1) {
      const ticket = await prisma.erhaTicket.update({
        where: { id },
        data: {
          status: body.status
        },
        include: {
          items: {
            include: {
              details: true
            },
            orderBy: { order: 'asc' }
          },
          remarks: {
          orderBy: { order: 'asc' }
        }
        }
      })
      return NextResponse.json(ticket)
    }

    // If only finalWorkImageData is provided, just update the screenshot
    if (body.finalWorkImageData !== undefined && Object.keys(body).length === 1) {
      const ticket = await prisma.erhaTicket.update({
        where: { id },
        data: {
          finalWorkImageData: body.finalWorkImageData
        },
        include: {
          items: {
            include: {
              details: true
            },
            orderBy: { order: 'asc' }
          },
          remarks: {
          orderBy: { order: 'asc' }
        }
        }
      })
      return NextResponse.json(ticket)
    }

    // Build combined billTo for PDF/uniqueness: "billTo - projectName"
    const combinedBillTo = (billToPart: string | undefined, projectNamePart: string | undefined): string => {
      const a = (billToPart ?? "").trim()
      const b = (projectNamePart ?? "").trim()
      return [a, b].filter(Boolean).join(" - ") || ""
    }
    const projectNameStored = (body.projectName ?? "").trim()
    const combined = combinedBillTo(body.billTo, body.projectName)
    const uniqueBillTo = combined ? await generateUniqueName(combined, 'erha', id) : combined

    const originalTicket = await prisma.erhaTicket.findUnique({
      where: { id },
      select: { projectName: true }
    })

    // Use transaction for atomic updates with UPSERT pattern
    const ticket = await prisma.$transaction(async (tx) => {
      // Update main ticket data
      const updated = await tx.erhaTicket.update({
        where: { id },
        data: {
          companyName: body.companyName,
          companyAddress: body.companyAddress,
          companyCity: body.companyCity,
          companyProvince: body.companyProvince,
          companyPostalCode: body.companyPostalCode || null,
          companyTelp: body.companyTelp || null,
          companyEmail: body.companyEmail || null,
          productionDate: new Date(body.productionDate),
          quotationDate: new Date(body.quotationDate),
          invoiceBastDate: new Date(body.invoiceBastDate),
          billTo: uniqueBillTo,
          projectName: projectNameStored,
          billToAddress: body.billToAddress || "",
          contactPerson: body.contactPerson,
          contactPosition: body.contactPosition,
          bastContactPerson: body.bastContactPerson ?? null,
          bastContactPosition: body.bastContactPosition ?? null,
          billingName: body.billingName,
          billingBankName: body.billingBankName,
          billingBankAccount: body.billingBankAccount,
          billingBankAccountName: body.billingBankAccountName,
          billingKtp: body.billingKtp || null,
          billingNpwp: body.billingNpwp || null,
          signatureName: body.signatureName,
          signatureRole: body.signatureRole || null,
          signatureImageData: body.signatureImageData,
          finalWorkImageData: body.finalWorkImageData || null,
          pph: body.pph,
          totalAmount: safeParseFloat(body.totalAmount),
          adjustmentPercentage: body.adjustmentPercentage != null ? parseFloat(body.adjustmentPercentage) : null,
          adjustmentNotes: body.adjustmentNotes ?? null,
          termsAndConditions: body.termsAndConditions || null,
          status: body.status,
        }
      })

      // Get existing item IDs
      const existingItems = await tx.erhaTicketItem.findMany({
        where: { ticketId: id },
        select: { id: true }
      })
      const existingItemIds = new Set(existingItems.map(item => item.id))

      // Collect IDs from incoming data
      const incomingItemIds = new Set(
        body.items?.map((item: any) => item.id).filter(Boolean) || []
      )

      // Process items with order
      const itemsWithOrder = (body.items || []).map((item: any, index: number) => ({
        ...item,
        order: index
      }))
      
      // Separate items into update vs create batches
      const itemsToUpdate = itemsWithOrder.filter((item: any) => item.id && existingItemIds.has(item.id))
      const itemsToCreate = itemsWithOrder.filter((item: any) => !item.id || !existingItemIds.has(item.id))
      
      // Collect all details to be deleted for updated items
      const itemIdsToDeleteDetails = itemsToUpdate.map((item: any) => item.id)
      
      // Update all existing items in parallel
      const updatePromises = itemsToUpdate.map((item: any) =>
        tx.erhaTicketItem.update({
          where: { id: item.id },
          data: {
            productName: item.productName,
            total: safeParseFloat(item.total),
            order: item.order
          }
        })
      )
      
      // Delete all old details for updated items (single query)
      const deleteDetailsPromise = itemIdsToDeleteDetails.length > 0
        ? tx.erhaTicketItemDetail.deleteMany({
            where: { itemId: { in: itemIdsToDeleteDetails } }
          })
        : Promise.resolve()
      
      // Create new items with details in parallel
      const createItemResults = await Promise.all(
        itemsToCreate.map((item: any) =>
          tx.erhaTicketItem.create({
            data: {
              ticketId: id,
              productName: item.productName,
              total: safeParseFloat(item.total),
              order: item.order,
              details: {
                create: item.details?.map((detail: any) => ({
                  detail: detail.detail,
                  unitPrice: safeParseFloat(detail.unitPrice),
                  qty: safeParseFloat(detail.qty),
                  amount: safeParseFloat(detail.amount)
                })) || []
              }
            }
          })
        )
      )
      
      // Execute all updates and deletes in parallel
      await Promise.all([...updatePromises, deleteDetailsPromise])
      
      // Collect newly created item IDs
      const newlyCreatedItemIds = createItemResults.map(item => item.id)
      
      // Bulk create new details for updated items
      const allNewDetails = itemsToUpdate.flatMap((item: any) =>
        (item.details || []).map((detail: any) => ({
          itemId: item.id,
          detail: detail.detail,
          unitPrice: safeParseFloat(detail.unitPrice),
          qty: safeParseFloat(detail.qty),
          amount: safeParseFloat(detail.amount)
        }))
      )
      
      if (allNewDetails.length > 0) {
        await tx.erhaTicketItemDetail.createMany({
          data: allNewDetails
        })
      }

      // Delete removed items
      const allKeptItemIds = [
        ...Array.from(incomingItemIds).filter((id): id is string => typeof id === 'string' && existingItemIds.has(id)),
        ...newlyCreatedItemIds
      ]
      
      await tx.erhaTicketItem.deleteMany({
        where: {
          ticketId: id,
          id: { notIn: allKeptItemIds }
        }
      })

      // Handle remarks using UPSERT pattern
      const existingRemarks = await tx.erhaTicketRemark.findMany({
        where: { ticketId: id },
        select: { id: true }
      })
      const existingRemarkIds = new Set(existingRemarks.map(remark => remark.id))

      const incomingRemarkIds = new Set(
        body.remarks?.map((remark: any) => remark.id).filter(Boolean) || []
      )

      const remarksToUpdate = (body.remarks || []).filter((remark: any) => remark.id && existingRemarkIds.has(remark.id))
      const remarksToCreate = (body.remarks || []).filter((remark: any) => !remark.id || !existingRemarkIds.has(remark.id))
      
      // Update existing remarks in parallel
      const updateRemarkPromises = remarksToUpdate.map((remark: any) =>
        tx.erhaTicketRemark.update({
          where: { id: remark.id },
          data: {
            text: remark.text,
            isCompleted: remark.isCompleted || false,
            order: (body.remarks || []).findIndex((r: any) => r.id === remark.id)
          }
        })
      )
      
      // Create new remarks
      let newlyCreatedRemarkIds: string[] = []
      if (remarksToCreate.length > 0) {
        const remarkData = remarksToCreate.map((remark: any) => ({
          ticketId: id,
          text: remark.text,
          isCompleted: remark.isCompleted || false,
          order: (body.remarks || []).findIndex((r: any) => r === remark)
        }))
        
        await tx.erhaTicketRemark.createMany({
          data: remarkData
        })
        
        // Fetch newly created remarks
        const newRemarks = await tx.erhaTicketRemark.findMany({
          where: {
            ticketId: id,
            order: { in: remarkData.map((r: any) => r.order) }
          },
          select: { id: true }
        })
        newlyCreatedRemarkIds = newRemarks.map(r => r.id)
      }
      
      // Execute remark updates
      await Promise.all(updateRemarkPromises)

      // Delete removed remarks
      const idsToKeep = [
        ...Array.from(incomingRemarkIds).filter((id): id is string => typeof id === 'string' && existingRemarkIds.has(id)),
        ...newlyCreatedRemarkIds
      ]
      
      await tx.erhaTicketRemark.deleteMany({
        where: {
          ticketId: id,
          id: { notIn: idsToKeep }
        }
      })

      // Return updated ticket with relations
      return tx.erhaTicket.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              details: true
            },
            orderBy: { order: 'asc' }
          },
          remarks: {
            orderBy: { order: 'asc' }
          }
        }
      })
    })

    // Sync tracker by projectName (list display name)
    if (ticket && ticket.projectName && ticket.projectName.trim()) {
      try {
        if (originalTicket && originalTicket.projectName !== ticket.projectName) {
          await updateTrackerName(
            originalTicket.projectName,
            ticket.projectName,
            ticket.productionDate,
            ticket.totalAmount
          )
        } else {
          await syncTracker({
            projectName: ticket.projectName,
            date: ticket.productionDate,
            totalAmount: ticket.totalAmount,
            subtotal: ticket.items?.reduce((sum, item) => sum + item.total, 0) || 0
          })
        }
      } catch (trackerError) {
        console.error("Error syncing tracker:", trackerError)
      }
    }

    // Invalidate caches after updating erha ticket
    await invalidateErhaCaches(id)

    return NextResponse.json(ticket)
  } catch (error) {
    console.error("Error updating erha ticket:", error)
    const message = error instanceof Error ? error.message : String(error)
    const isPayloadTooLarge =
      message.includes("body") ||
      message.includes("payload") ||
      message.includes("size") ||
      message.includes("413") ||
      message.includes("limit")
    const userMessage = isPayloadTooLarge
      ? "Request too large. Try using smaller images for signature and screenshot."
      : message || "Failed to update erha ticket"
    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    )
  }
}

// DELETE erha ticket
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.erhaTicket.delete({
      where: { id }
    })

    // Invalidate caches after deleting erha ticket
    await invalidateErhaCaches(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting erha ticket:", error)
    return NextResponse.json(
      { error: "Failed to delete erha ticket" },
      { status: 500 }
    )
  }
}

