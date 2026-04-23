import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Helper function to format date for ICS (YYYYMMDDTHHMMSSZ)
function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

// Helper function to format date in local timezone for ICS (YYYYMMDDTHHMMSS)
function formatICSDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hours}${minutes}${seconds}`
}

// Helper function to escape ICS text
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

// Helper function to format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

// GET ICS calendar feed
export async function GET() {
  try {
    // Get events for the next 12 months
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 1) // Include last month
    
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + 12) // Next 12 months

    // Fetch accepted quotations
    const quotations = await prisma.quotation.findMany({
      where: {
        status: "accepted",
        deletedAt: null,
        productionDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        quotationId: true,
        companyName: true,
        productionDate: true,
        totalAmount: true,
        billTo: true,
        updatedAt: true,
      },
      orderBy: {
        productionDate: "asc"
      }
    })

    // Fetch Paragon tickets (finalized status)
    const paragonTickets = await prisma.paragonTicket.findMany({
      where: {
        status: "finalized",
        deletedAt: null,
        productionDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        ticketId: true,
        companyName: true,
        productionDate: true,
        totalAmount: true,
        billTo: true,
        projectName: true,
        updatedAt: true,
      }
    })

    // Fetch Erha tickets (finalized status)
    const erhaTickets = await prisma.erhaTicket.findMany({
      where: {
        status: "finalized",
        deletedAt: null,
        productionDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        ticketId: true,
        companyName: true,
        productionDate: true,
        totalAmount: true,
        billTo: true,
        projectName: true,
        updatedAt: true,
      }
    })
    // Fetch Barclay tickets (finalized status)
    const barclayTickets = await prisma.barclayTicket.findMany({
      where: {
        status: "finalized",
        deletedAt: null,
        productionDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        ticketId: true,
        companyName: true,
        productionDate: true,
        totalAmount: true,
        billTo: true,
        projectName: true,
        updatedAt: true,
      }
    })

    // Fetch pending invoices (for daily reminder)
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Start of today
    
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        status: "pending",
        deletedAt: null,
        paidDate: {
          lte: today, // Payment date has passed or is today
        }
      },
      select: {
        id: true,
        invoiceId: true,
        billTo: true,
        totalAmount: true,
        paidDate: true,
        productionDate: true,
      },
      orderBy: {
        paidDate: "asc"
      }
    })

    // Generate ICS content
    const now = new Date()
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Master Dashboard//Production Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Production Schedule',
      'X-WR-TIMEZONE:Asia/Jakarta',
      'X-WR-CALDESC:Production schedule from Master Dashboard',
      // Add timezone definition for Asia/Jakarta
      'BEGIN:VTIMEZONE',
      'TZID:Asia/Jakarta',
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      'TZOFFSETFROM:+0700',
      'TZOFFSETTO:+0700',
      'TZNAME:WIB',
      'END:STANDARD',
      'END:VTIMEZONE',
    ]

    // Add quotation events
    quotations.forEach(q => {
      const eventStart = new Date(q.productionDate)
      const eventEnd = new Date(q.productionDate)
      eventEnd.setHours(23, 59, 59)

      const title = q.billTo || q.quotationId
      const summary = `🎬 ${escapeICSText(title)}`
      const description = [
        `Type: Quotation`,
        `ID: ${q.quotationId}`,
        `Company: ${q.companyName}`,
        `Bill To: ${q.billTo}`,
        `Amount: ${formatCurrency(q.totalAmount)}`,
      ].filter(Boolean).join('\\n')

      icsLines.push(
        'BEGIN:VEVENT',
        `UID:quotation-${q.id}@master-dashboard`,
        `DTSTAMP:${formatICSDate(now)}`,
        `DTSTART;VALUE=DATE:${eventStart.toISOString().split('T')[0].replace(/-/g, '')}`,
        `DTEND;VALUE=DATE:${eventEnd.toISOString().split('T')[0].replace(/-/g, '')}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `LAST-MODIFIED:${formatICSDate(new Date(q.updatedAt))}`,
        `CATEGORIES:Production,Quotation`,
        `STATUS:CONFIRMED`,
        'END:VEVENT'
      )
    })

    // Add Paragon ticket events
    paragonTickets.forEach(t => {
      const eventStart = new Date(t.productionDate)
      const eventEnd = new Date(t.productionDate)
      eventEnd.setHours(23, 59, 59)

      const title = (t.projectName?.trim() || t.billTo) || t.ticketId
      const summary = `🏥 Paragon - ${escapeICSText(title)}`
      const description = [
        `Type: Paragon Ticket`,
        `ID: ${t.ticketId}`,
        `Company: ${t.companyName}`,
        `Bill To: ${t.billTo}`,
        `Amount: ${formatCurrency(t.totalAmount)}`,
      ].filter(Boolean).join('\\n')

      icsLines.push(
        'BEGIN:VEVENT',
        `UID:paragon-${t.id}@master-dashboard`,
        `DTSTAMP:${formatICSDate(now)}`,
        `DTSTART;VALUE=DATE:${eventStart.toISOString().split('T')[0].replace(/-/g, '')}`,
        `DTEND;VALUE=DATE:${eventEnd.toISOString().split('T')[0].replace(/-/g, '')}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `LAST-MODIFIED:${formatICSDate(new Date(t.updatedAt))}`,
        `CATEGORIES:Production,Paragon`,
        `STATUS:CONFIRMED`,
        'END:VEVENT'
      )
    })

    // Add Erha ticket events
    erhaTickets.forEach(t => {
      const eventStart = new Date(t.productionDate)
      const eventEnd = new Date(t.productionDate)
      eventEnd.setHours(23, 59, 59)

      const title = (t.projectName?.trim() || t.billTo) || t.ticketId
      const summary = `💆 Erha - ${escapeICSText(title)}`
      const description = [
        `Type: Erha Ticket`,
        `ID: ${t.ticketId}`,
        `Company: ${t.companyName}`,
        `Bill To: ${t.billTo}`,
        `Amount: ${formatCurrency(t.totalAmount)}`,
      ].filter(Boolean).join('\\n')

      icsLines.push(
        'BEGIN:VEVENT',
        `UID:erha-${t.id}@master-dashboard`,
        `DTSTAMP:${formatICSDate(now)}`,
        `DTSTART;VALUE=DATE:${eventStart.toISOString().split('T')[0].replace(/-/g, '')}`,
        `DTEND;VALUE=DATE:${eventEnd.toISOString().split('T')[0].replace(/-/g, '')}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `LAST-MODIFIED:${formatICSDate(new Date(t.updatedAt))}`,
        `CATEGORIES:Production,Erha`,
        `STATUS:CONFIRMED`,
        'END:VEVENT'
      )
    })

    // Add Barclay ticket events
    barclayTickets.forEach(t => {
      const eventStart = new Date(t.productionDate)
      const eventEnd = new Date(t.productionDate)
      eventEnd.setHours(23, 59, 59)

      const title = (t.projectName?.trim() || t.billTo) || t.ticketId
      const summary = `🏦 Barclay - ${escapeICSText(title)}`
      const description = [
        `Type: Barclay Ticket`,
        `ID: ${t.ticketId}`,
        `Company: ${t.companyName}`,
        `Bill To: ${t.billTo}`,
        `Amount: ${formatCurrency(t.totalAmount)}`,
      ].filter(Boolean).join('\\n')

      icsLines.push(
        'BEGIN:VEVENT',
        `UID:barclay-${t.id}@master-dashboard`,
        `DTSTAMP:${formatICSDate(now)}`,
        `DTSTART;VALUE=DATE:${eventStart.toISOString().split('T')[0].replace(/-/g, '')}`,
        `DTEND;VALUE=DATE:${eventEnd.toISOString().split('T')[0].replace(/-/g, '')}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `LAST-MODIFIED:${formatICSDate(new Date(t.updatedAt))}`,
        `CATEGORIES:Production,Barclay`,
        `STATUS:CONFIRMED`,
        'END:VEVENT'
      )
    })

    // Add pending invoice reminder (daily event at 3 PM)
    if (pendingInvoices.length > 0) {
      const todayDateStr = today.toISOString().split('T')[0].replace(/-/g, '')
      const reminderStart = new Date(today)
      reminderStart.setHours(15, 0, 0, 0) // 3 PM local time
      
      const reminderEnd = new Date(today)
      reminderEnd.setHours(16, 0, 0, 0) // 4 PM local time (1 hour duration)

      // Build description with all pending invoices
      const invoiceList = pendingInvoices.map(inv => {
        const daysOverdue = inv.paidDate 
          ? Math.floor((today.getTime() - new Date(inv.paidDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0
        const overdueText = daysOverdue > 0 ? ` (${daysOverdue} days overdue)` : ' (Due today)'
        
        return `• ${inv.invoiceId} - ${inv.billTo} - ${formatCurrency(inv.totalAmount)}${overdueText}`
      }).join('\\n')

      const summary = `💰 ${pendingInvoices.length} Pending Invoice${pendingInvoices.length > 1 ? 's' : ''} - Payment Reminder`
      const description = [
        `You have ${pendingInvoices.length} pending invoice(s) that need attention:`,
        ``,
        invoiceList,
        ``,
        `Please follow up on these payments.`,
      ].join('\\n')

      icsLines.push(
        'BEGIN:VEVENT',
        `UID:pending-invoices-${todayDateStr}@master-dashboard`,
        `DTSTAMP:${formatICSDate(now)}`,
        `DTSTART;TZID=Asia/Jakarta:${formatICSDateLocal(reminderStart)}`,
        `DTEND;TZID=Asia/Jakarta:${formatICSDateLocal(reminderEnd)}`,
        `SUMMARY:${escapeICSText(summary)}`,
        `DESCRIPTION:${description}`,
        `CATEGORIES:Invoice,Reminder,Pending`,
        `STATUS:CONFIRMED`,
        `PRIORITY:1`,
        // Add alarm/reminder - 10 minutes before (at 2:50 PM)
        'BEGIN:VALARM',
        'TRIGGER:-PT10M',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeICSText(`${pendingInvoices.length} pending invoice(s) need your attention`)}`,
        'END:VALARM',
        'END:VEVENT'
      )
    }

    icsLines.push('END:VCALENDAR')

    const icsContent = icsLines.join('\r\n')

    // Return ICS file with proper headers
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="production-calendar.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error("Error generating ICS calendar:", error)
    return NextResponse.json(
      { error: "Failed to generate calendar feed" },
      { status: 500 }
    )
  }
}
