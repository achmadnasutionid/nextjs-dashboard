import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRecordVersion, OptimisticLockError } from "@/lib/optimistic-locking"
import { invalidateInvoiceCaches } from "@/lib/cache-invalidation"
import { generateUniqueName } from "@/lib/name-validator"
import { syncTracker, updateTrackerName } from "@/lib/tracker-sync"
import { safeParseFloat } from "@/lib/number-validator"

// GET single invoice
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const invoice = await prisma.invoice.findUnique({
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
        },
        signatures: {
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error("Error fetching invoice:", error)
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    )
  }
}

// PUT update invoice (Optimized with UPSERT pattern)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const current = await prisma.invoice.findUnique({
      where: { id },
      select: { status: true }
    })
    // When already paid, allow content edits but status must stay paid (no downgrade)
    const keepFinalStatus = current?.status === "paid"

    // If only status is provided, just update the status (for marking invoice as paid)
    if (body.status && Object.keys(body).length === 1) {
      const newStatus = keepFinalStatus ? "paid" : body.status
      const invoice = await prisma.invoice.update({
        where: { id },
        data: {
          status: newStatus
        },
        include: {
          items: {
            include: {
              details: true
            }
          }
        }
      })
      
      return NextResponse.json(invoice)
    }

    // OPTIMISTIC LOCKING: Check if record was modified by another user
    if (body.updatedAt) {
      const currentRecord = await prisma.invoice.findUnique({
        where: { id },
        select: { updatedAt: true }
      })
      
      try {
        verifyRecordVersion(body.updatedAt, currentRecord)
      } catch (error) {
        if (error instanceof OptimisticLockError) {
          return NextResponse.json(
            { 
              error: "CONFLICT",
              message: error.message,
              code: "OPTIMISTIC_LOCK_ERROR"
            },
            { status: 409 }
          )
        }
        throw error
      }
    }

    // Capture original billTo BEFORE update so we can detect renames and update tracker (not create a new one)
    const originalInvoiceForTracker = await prisma.invoice.findUnique({
      where: { id },
      select: { billTo: true }
    })
    const originalBillTo = originalInvoiceForTracker?.billTo ?? null

    // Use transaction for atomic updates with UPSERT pattern
    const invoice = await prisma.$transaction(async (tx) => {
      // Calculate paidDate if needed
      let paidDate = body.paidDate ? new Date(body.paidDate) : null
      
      // Generate unique billTo name if there's a conflict
      const uniqueBillTo = body.billTo ? await generateUniqueName(body.billTo, 'invoice', id) : body.billTo
      
      // Update main invoice data
      const updated = await tx.invoice.update({
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
          paidDate: paidDate,
          billTo: uniqueBillTo,
          notes: body.notes || null,
          billingName: body.billingName,
          billingBankName: body.billingBankName,
          billingBankAccount: body.billingBankAccount,
          billingBankAccountName: body.billingBankAccountName,
          billingKtp: body.billingKtp || null,
          billingNpwp: body.billingNpwp || null,
          signatureName: body.signatureName,
          signatureRole: body.signatureRole || null,
          signatureImageData: body.signatureImageData,
          pph: body.pph,
          totalAmount: safeParseFloat(body.totalAmount),
          summaryOrder: body.summaryOrder || "subtotal,pph,downPayment,total",
          adjustmentPercentage: body.adjustmentPercentage != null ? parseFloat(body.adjustmentPercentage) : null,
          adjustmentNotes: body.adjustmentNotes ?? null,
          downPaymentPercentage: body.downPaymentPercentage != null ? parseFloat(body.downPaymentPercentage) : null,
          termsAndConditions: body.termsAndConditions || null,
          status: keepFinalStatus ? "paid" : (body.status || "draft"),
        }
      })

      // Get existing item IDs from database
      const existingItems = await tx.invoiceItem.findMany({
        where: { invoiceId: id },
        select: { id: true }
      })
      const existingItemIds = new Set(existingItems.map(item => item.id))

      // Collect IDs from incoming data
      const incomingItemIds = new Set(
        body.items?.map((item: any) => item.id).filter(Boolean) || []
      )
      const incomingRemarkIds = new Set(
        body.remarks?.map((remark: any) => remark.id).filter(Boolean) || []
      )

      // UPSERT items and details (OPTIMIZED - batch operations)
      // Process items in order, preserving their position from the frontend
      const itemsWithOrder = (body.items || []).map((item: any, index: number) => ({
        ...item,
        order: index
      }))
      
      // Separate items into update vs create batches
      const itemsToUpdate = itemsWithOrder.filter((item: any) => item.id && existingItemIds.has(item.id))
      const itemsToCreate = itemsWithOrder.filter((item: any) => !item.id || !existingItemIds.has(item.id))
      
      // Collect all details to be deleted for updated items
      const itemIdsToDeleteDetails = itemsToUpdate.map((item: any) => item.id)
      
      // Step 1: Update all existing items in parallel
      const updatePromises = itemsToUpdate.map((item: any) =>
        tx.invoiceItem.update({
          where: { id: item.id },
          data: {
            productName: item.productName,
            total: safeParseFloat(item.total),
            order: item.order
          }
        })
      )
      
      // Step 2: Delete all old details for updated items (single query)
      const deleteDetailsPromise = itemIdsToDeleteDetails.length > 0
        ? tx.invoiceItemDetail.deleteMany({
            where: { invoiceItemId: { in: itemIdsToDeleteDetails } }
          })
        : Promise.resolve()
      
      // Step 3: Create new items with details in parallel
      const createItemResults = await Promise.all(
        itemsToCreate.map((item: any) =>
          tx.invoiceItem.create({
            data: {
              invoiceId: id,
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
      
      // Collect newly created item IDs to prevent them from being deleted
      const newlyCreatedItemIds = createItemResults.map(item => item.id)
      
      // Step 4: Bulk create new details for updated items
      const allNewDetails = itemsToUpdate.flatMap((item: any) =>
        (item.details || []).map((detail: any) => ({
          invoiceItemId: item.id,
          detail: detail.detail,
          unitPrice: safeParseFloat(detail.unitPrice),
          qty: safeParseFloat(detail.qty),
          amount: safeParseFloat(detail.amount)
        }))
      )
      
      if (allNewDetails.length > 0) {
        await tx.invoiceItemDetail.createMany({
          data: allNewDetails
        })
      }

      // Delete removed items (items not in incoming data AND not just created)
      // Combine existing item IDs from frontend with newly created IDs
      const allKeptItemIds = [
        ...Array.from(incomingItemIds).filter((id): id is string => typeof id === 'string' && existingItemIds.has(id)),
        ...newlyCreatedItemIds
      ]
      
      await tx.invoiceItem.deleteMany({
        where: {
          invoiceId: id,
          id: { notIn: allKeptItemIds }
        }
      })

      // Get existing remark IDs from database
      const existingRemarks = await tx.invoiceRemark.findMany({
        where: { invoiceId: id },
        select: { id: true }
      })
      const existingRemarkIds = new Set(existingRemarks.map(remark => remark.id))

      console.log("[INVOICE UPDATE] Existing remark IDs:", Array.from(existingRemarkIds))
      console.log("[INVOICE UPDATE] Incoming remarks:", body.remarks)

      // UPSERT remarks (OPTIMIZED - batch operations)
      const remarksToUpdate = (body.remarks || []).filter((remark: any) => remark.id && existingRemarkIds.has(remark.id))
      const remarksToCreate = (body.remarks || []).filter((remark: any) => !remark.id || !existingRemarkIds.has(remark.id))
      
      console.log("[INVOICE UPDATE] Remarks to update:", remarksToUpdate.length)
      console.log("[INVOICE UPDATE] Remarks to create:", remarksToCreate.length)
      
      // Update all existing remarks in parallel (with order)
      const updateRemarkPromises = remarksToUpdate.map((remark: any) =>
        tx.invoiceRemark.update({
          where: { id: remark.id },
          data: {
            text: remark.text,
            isCompleted: remark.isCompleted || false,
            order: (body.remarks || []).findIndex((r: any) => r.id === remark.id)
          }
        })
      )
      
      // Create new remarks using createMany for better performance (with order)
      const createRemarkPromise = remarksToCreate.length > 0
        ? tx.invoiceRemark.createMany({
            data: remarksToCreate.map((remark: any, index: number) => ({
              invoiceId: id,
              text: remark.text,
              isCompleted: remark.isCompleted || false,
              order: (body.remarks || []).findIndex((r: any) => r.id === remark.id)
            }))
          })
        : Promise.resolve()
      
      // Execute all remark operations in parallel
      await Promise.all([...updateRemarkPromises, createRemarkPromise])

      // After creating, fetch the newly created remark IDs
      let newlyCreatedRemarkIds: string[] = []
      if (remarksToCreate.length > 0) {
        const remarkOrders = remarksToCreate.map((remark: any) => 
          (body.remarks || []).findIndex((r: any) => r.id === remark.id)
        )
        const newRemarks = await tx.invoiceRemark.findMany({
          where: {
            invoiceId: id,
            order: { in: remarkOrders }
          },
          select: { id: true }
        })
        newlyCreatedRemarkIds = newRemarks.map(r => r.id)
      }

      // Delete removed remarks (but NOT the newly created ones)
      const idsToKeep = [
        ...Array.from(incomingRemarkIds).filter((id): id is string => typeof id === 'string' && existingRemarkIds.has(id)),
        ...newlyCreatedRemarkIds
      ]
      
      await tx.invoiceRemark.deleteMany({
        where: {
          invoiceId: id,
          id: { notIn: idsToKeep }
        }
      })

      // Get existing signature IDs from database
      const existingSignatures = await tx.invoiceSignature.findMany({
        where: { invoiceId: id },
        select: { id: true }
      })
      const existingSignatureIds = new Set(existingSignatures.map(sig => sig.id))

      // Collect incoming signature IDs (only the ones that exist in DB already)
      const incomingSignatureIds = new Set(
        body.customSignatures?.map((sig: any) => sig.id).filter((id: string) => id && existingSignatureIds.has(id)) || []
      )

      // UPSERT signatures (OPTIMIZED - batch operations)
      const signaturesToUpdate = (body.customSignatures || []).filter((sig: any) => sig.id && existingSignatureIds.has(sig.id))
      const signaturesToCreate = (body.customSignatures || []).filter((sig: any) => !sig.id || !existingSignatureIds.has(sig.id))
      
      // Update all existing signatures in parallel (with order)
      const updateSignaturePromises = signaturesToUpdate.map((sig: any) =>
        tx.invoiceSignature.update({
          where: { id: sig.id },
          data: {
            name: sig.name,
            position: sig.position,
            imageData: sig.imageData || "",
            order: (body.customSignatures || []).findIndex((s: any) => s.id === sig.id)
          }
        })
      )
      
      // Execute all signature update operations FIRST
      await Promise.all(updateSignaturePromises)
      
      // Create new signatures using createMany for better performance (with order)
      let newlyCreatedSignatureIds: string[] = []
      if (signaturesToCreate.length > 0) {
        const createResult = await tx.invoiceSignature.createManyAndReturn({
          data: signaturesToCreate.map((sig: any) => ({
            invoiceId: id,
            name: sig.name,
            position: sig.position,
            imageData: sig.imageData || "",
            order: (body.customSignatures || []).findIndex((s: any) => s === sig)
          })),
          select: { id: true }
        })
        newlyCreatedSignatureIds = createResult.map((sig: any) => sig.id)
      }

      // Delete removed signatures (keep existing ones that were in the request + newly created ones)
      const allKeptSignatureIds: string[] = [
        ...(Array.from(incomingSignatureIds) as string[]), // Only IDs that exist in DB
        ...newlyCreatedSignatureIds // Newly created IDs from DB
      ]
      
      await tx.invoiceSignature.deleteMany({
        where: {
          invoiceId: id,
          id: { notIn: allKeptSignatureIds }
        }
      })


      // Return updated invoice with relations
      return tx.invoice.findUnique({
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
          },
          signatures: {
            orderBy: { order: 'asc' }
          }
        }
      })
    })

    // Sync tracker if billTo changed or totalAmount changed
    if (invoice && invoice.billTo && invoice.billTo.trim()) {
      try {
        if (originalBillTo != null && originalBillTo !== invoice.billTo) {
          // billTo changed - update existing tracker name (don't create new one)
          await updateTrackerName(
            originalBillTo,
            invoice.billTo,
            invoice.productionDate,
            invoice.totalAmount,
            invoice.invoiceId
          )
        } else {
          // billTo same - just sync data (invoice data takes priority)
          await syncTracker({
            projectName: invoice.billTo,
            date: invoice.productionDate,
            totalAmount: invoice.totalAmount,
            invoiceId: invoice.invoiceId,
            subtotal: invoice.items?.reduce((sum, item) => sum + item.total, 0) || 0
          })
        }
      } catch (trackerError) {
        console.error("Error syncing tracker:", trackerError)
        // Don't fail invoice update if tracker sync fails
      }
    }

    // Invalidate caches after updating invoice
    await invalidateInvoiceCaches(id)

    return NextResponse.json(invoice)
  } catch (error) {
    console.error("Error updating invoice:", error)
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: "A record with this data already exists" },
          { status: 409 }
        )
      }
    }
    
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    )
  }
}

// DELETE invoice
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Delete the invoice
    await prisma.invoice.delete({
      where: { id }
    })

    // Invalidate caches after deleting invoice
    await invalidateInvoiceCaches(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting invoice:", error)
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    )
  }
}

