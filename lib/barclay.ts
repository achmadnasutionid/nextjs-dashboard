function normalizeValue(value: string): string {
  return value.trim().toLowerCase()
}

export function extractClientNameFromBillTo(billTo: string, projectName?: string): string {
  const trimmedBillTo = billTo.trim()
  if (!trimmedBillTo) return ""

  const trimmedProjectName = (projectName ?? "").trim()
  if (!trimmedProjectName) return trimmedBillTo

  const suffix = ` - ${trimmedProjectName}`
  return trimmedBillTo.endsWith(suffix)
    ? trimmedBillTo.slice(0, -suffix.length).trim()
    : trimmedBillTo
}

export function isBarclayTicket(billTo: string, projectName?: string): boolean {
  const clientName = extractClientNameFromBillTo(billTo, projectName)
  return normalizeValue(clientName).includes("barclay")
}
