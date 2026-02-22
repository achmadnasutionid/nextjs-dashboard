import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const ticket = await prisma.paragonTicket.findUnique({
      where: { id }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: "Paragon ticket not found" },
        { status: 404 }
      )
    }

    if (ticket.status === "final") {
      return NextResponse.json(
        { error: "Ticket is already finalized" },
        { status: 400 }
      )
    }

    await prisma.paragonTicket.update({
      where: { id },
      data: { status: "final" }
    })

    return NextResponse.json({
      success: true,
      ticket: { id: ticket.id, status: "final" }
    })
  } catch (error: unknown) {
    console.error("Error finalizing Paragon ticket:", error)
    return NextResponse.json(
      {
        error: "Failed to finalize ticket",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
