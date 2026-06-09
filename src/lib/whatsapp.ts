import "server-only"

/** Normalise an Indian phone number to international digits (E.164 without +). */
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith("91")) return digits
  if (digits.length > 10) return digits
  return null
}

/** Build a click-to-chat wa.me URL with a prefilled message. */
export function waMeLink(phone: string, message: string): string | null {
  const p = normalizePhone(phone)
  if (!p) return null
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`
}

/**
 * Send a text message via the WhatsApp Cloud API (Meta). Returns false when
 * not configured, so callers can fall back to a click-to-chat link.
 */
export async function sendWhatsAppText(phone: string, message: string): Promise<boolean> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const version = process.env.WHATSAPP_API_VERSION || "v21.0"
  const to = normalizePhone(phone)
  if (!token || !phoneId || !to) return false

  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
