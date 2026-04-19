import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRecordVersion, OptimisticLockError } from "@/lib/optimistic-locking"
import { invalidateQuotationCaches } from "@/lib/cache-invalidation"
import { generateUniqueName } from "@/lib/name-validator"
import { syncTracker, updateTrackerName } from "@/lib/tracker-sync"
import { safeParseFloat } from "@/lib/number-validator"

// GET single quotation
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const quotation = await prisma.quotation.findUnique({
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

    if (!quotation) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(quotation)
  } catch (error) {
    console.error("Error fetching quotation:", error)
    return NextResponse.json(
      { error: "Failed to fetch quotation" },
      { status: 500 }
    )
  }
}

// PUT update quotation (Optimized with UPSERT pattern)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const current = await prisma.quotation.findUnique({
      where: { id },
      select: { status: true }
    })
    // When already accepted, allow content edits but status must stay accepted (no downgrade)
    const keepFinalStatus = current?.status === "accepted"

    // If only status is provided, just update the status (for accepting quotation)
    if (body.status && Object.keys(body).length === 1) {
      const newStatus = keepFinalStatus ? "accepted" : body.status
      const quotation = await prisma.quotation.update({
        where: { id },
        data: {
          status: newStatus
        },
        include: {
          items: {
            include: {
              details: true
            }
          },
          remarks: true
        }
      })
      
      return NextResponse.json(quotation)
    }

    // OPTIMISTIC LOCKING: Check if record was modified by another user
    // Client should send the `updatedAt` timestamp they have
    if (body.updatedAt) {
      const currentRecord = await prisma.quotation.findUnique({
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
    const originalQuotation = await prisma.quotation.findUnique({
      where: { id },
      select: { billTo: true }
    })
    const originalBillTo = originalQuotation?.billTo ?? null

    // Use transaction for atomic updates with UPSERT pattern
    const quotation = await prisma.$transaction(async (tx) => {
      // Generate unique billTo name if there's a conflict
      const uniqueBillTo = body.billTo ? await generateUniqueName(body.billTo, 'quotation', id) : body.billTo
      
      // Update main quotation data
      const updated = await tx.quotation.update({
        where: { id },
        data: {
          companyName: body.companyName,
          companyAddress: body.companyAddress,
          companyCity: body.companyCity,
          companyProvince: body.companyProvince,
          companyTelp: body.companyTelp || null,
          companyEmail: body.companyEmail || null,
          productionDate: new Date(body.productionDate),
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
          summaryOrder: body.summaryOrder || "subtotal,pph,total",
          adjustmentPercentage: body.adjustmentPercentage != null ? parseFloat(body.adjustmentPercentage) : null,
          adjustmentNotes: body.adjustmentNotes ?? null,
          termsAndConditions: body.termsAndConditions || null,
          status: keepFinalStatus ? "accepted" : (body.status || "draft"),
        }
      })

      // Get existing item IDs from database
      const existingItems = await tx.quotationItem.findMany({
        where: { quotationId: id },
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
        tx.quotationItem.update({
          where: { id: item.id },
          data: {
            productName: item.productName,
            total: parseFloat(item.total),
            order: item.order
          }
        })
      )
      
      // Step 2: Delete all old details for updated items (single query)
      const deleteDetailsPromise = itemIdsToDeleteDetails.length > 0
        ? tx.quotationItemDetail.deleteMany({
            where: { quotationItemId: { in: itemIdsToDeleteDetails } }
          })
        : Promise.resolve()
      
      // Step 3: Create new items with details in parallel
      const createItemResults = await Promise.all(
        itemsToCreate.map((item: any) =>
          tx.quotationItem.create({
            data: {
              quotationId: id,
              productName: item.productName,
              total: parseFloat(item.total),
              order: item.order,
              details: {
                create: item.details?.map((detail: any) => ({
                  detail: detail.detail,
                  unitPrice: parseFloat(detail.unitPrice),
                  qty: parseFloat(detail.qty),
                  amount: parseFloat(detail.amount)
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
          quotationItemId: item.id,
          detail: detail.detail,
          unitPrice: parseFloat(detail.unitPrice),
          qty: parseFloat(detail.qty),
          amount: parseFloat(detail.amount)
        }))
      )
      
      if (allNewDetails.length > 0) {
        await tx.quotationItemDetail.createMany({
          data: allNewDetails
        })
      }

      // Delete removed items (items not in incoming data AND not just created)
      // Combine existing item IDs from frontend with newly created IDs
      const allKeptItemIds = [
        ...Array.from(incomingItemIds).filter((id): id is string => typeof id === 'string' && existingItemIds.has(id)),
        ...newlyCreatedItemIds
      ]
      
      await tx.quotationItem.deleteMany({
        where: {
          quotationId: id,
          id: { notIn: allKeptItemIds }
        }
      })

      // Get existing remark IDs from database
      const existingRemarks = await tx.quotationRemark.findMany({
        where: { quotationId: id },
        select: { id: true }
      })
      const existingRemarkIds = new Set(existingRemarks.map(remark => remark.id))

      // UPSERT remarks (OPTIMIZED - batch operations)
      const remarksToUpdate = (body.remarks || []).filter((remark: any) => remark.id && existingRemarkIds.has(remark.id))
      const remarksToCreate = (body.remarks || []).filter((remark: any) => !remark.id || !existingRemarkIds.has(remark.id))
      
      // Update all existing remarks in parallel (with order)
      const updateRemarkPromises = remarksToUpdate.map((remark: any) =>
        tx.quotationRemark.update({
          where: { id: remark.id },
          data: {
            text: remark.text,
            isCompleted: remark.isCompleted || false,
            order: (body.remarks || []).findIndex((r: any) => r.id === remark.id)
          }
        })
      )
      
      // Create new remarks using createMany for better performance (with order)
      let createRemarkResult
      const newlyCreatedRemarkIds: string[] = []
      
      if (remarksToCreate.length > 0) {
        try {
          const remarkData = remarksToCreate.map((remark: any, index: number) => {
            const order = (body.remarks || []).findIndex((r: any) => r.id === remark.id)
            return {
              quotationId: id,
              text: remark.text,
              isCompleted: remark.isCompleted || false,
              order: order
            }
          })
          
          // Note: createMany doesn't return the created records, so we need to fetch them
          // to get their actual IDs for the deletion exclusion logic
          createRemarkResult = await tx.quotationRemark.createMany({
            data: remarkData
          })
          
          // Fetch the newly created remarks to get their actual database IDs
          const newRemarks = await tx.quotationRemark.findMany({
            where: {
              quotationId: id,
              order: { in: remarkData.map((r: any) => r.order) }
            },
            select: { id: true }
          })
          newlyCreatedRemarkIds.push(...newRemarks.map(r => r.id))
        } catch (error) {
          console.error("[QUOTATION UPDATE] Error creating remarks:", error)
          throw error
        }
      }
      
      // Execute all remark UPDATE operations
      await Promise.all(updateRemarkPromises)

      // Delete removed remarks (but NOT the newly created ones)
      const idsToKeep = [
        ...Array.from(incomingRemarkIds).filter((id): id is string => typeof id === 'string' && existingRemarkIds.has(id)),
        ...newlyCreatedRemarkIds
      ]
      
      await tx.quotationRemark.deleteMany({
        where: {
          quotationId: id,
          id: { notIn: idsToKeep }
        }
      })

      // Get existing signature IDs from database
      const existingSignatures = await tx.quotationSignature.findMany({
        where: { quotationId: id },
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
        tx.quotationSignature.update({
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
        const createResult = await tx.quotationSignature.createManyAndReturn({
          data: signaturesToCreate.map((sig: any) => ({
            quotationId: id,
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
      
      const signatureDeleteResult = await tx.quotationSignature.deleteMany({
        where: {
          quotationId: id,
          id: { notIn: allKeptSignatureIds }
        }
      })


      // Return updated quotation with relations
      const result = await tx.quotation.findUnique({
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
      
      return result
    })

    // Sync tracker if billTo changed or totalAmount changed
    if (quotation && quotation.billTo && quotation.billTo.trim()) {
      try {
        if (originalBillTo != null && originalBillTo !== quotation.billTo) {
          // billTo changed - update existing tracker name (don't create new one)
          await updateTrackerName(
            originalBillTo,
            quotation.billTo,
            quotation.productionDate,
            quotation.totalAmount
          )
        } else {
          // billTo same - just sync data
          await syncTracker({
            projectName: quotation.billTo,
            date: quotation.productionDate,
            totalAmount: quotation.totalAmount,
            subtotal: quotation.items?.reduce((sum, item) => sum + item.total, 0) || 0
          })
        }
      } catch (trackerError) {
        console.error("Error syncing tracker:", trackerError)
        // Don't fail quotation update if tracker sync fails
      }
    }

    // Invalidate caches after updating quotation
    await invalidateQuotationCaches(id)

    return NextResponse.json(quotation)
  } catch (error) {
    console.error("Error updating quotation:", error)
    
    // Handle specific error types
    if (error instanceof Error) {
      // Prisma unique constraint violation
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: "A record with this data already exists" },
          { status: 409 }
        )
      }
    }
    
    return NextResponse.json(
      { error: "Failed to update quotation" },
      { status: 500 }
    )
  }
}

// DELETE quotation
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Delete the quotation
    await prisma.quotation.delete({
      where: { id }
    })

    // Invalidate caches after deleting quotation
    await invalidateQuotationCaches(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting quotation:", error)
    return NextResponse.json(
      { error: "Failed to delete quotation" },
      { status: 500 }
    )
  }
}

