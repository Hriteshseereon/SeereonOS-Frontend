// Razorpay Checkout, loaded on demand (only when a payment is started). The server creates the order and verifies
// the signed result; this module only opens the provider's own payment window.
// CSP needs: script-src https://checkout.razorpay.com; frame-src https://api.razorpay.com https://checkout.razorpay.com;
// connect-src https://api.razorpay.com https://lumberjack.razorpay.com.

const SRC = 'https://checkout.razorpay.com/v1/checkout.js'

export interface RazorpaySuccess {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}
export interface RazorpayOptions {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description?: string
  prefill?: { name?: string; email?: string; contact?: string }
  notes?: Record<string, string>
  theme?: { color?: string }
}
interface RazorpayInstance {
  open: () => void
  on: (event: 'payment.failed', cb: (r: { error?: { description?: string; reason?: string } }) => void) => void
}
type RazorpayCtor = new (o: RazorpayOptions & { handler: (r: RazorpaySuccess) => void; modal?: { ondismiss?: () => void; confirm_close?: boolean } }) => RazorpayInstance

let loading: Promise<RazorpayCtor> | null = null

function load(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor }
  if (w.Razorpay) return Promise.resolve(w.Razorpay)
  if (!loading)
    loading = new Promise<RazorpayCtor>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SRC
      s.async = true
      s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error('The payment window did not load.')))
      s.onerror = () => {
        loading = null
        s.remove()
        reject(new Error('Could not load the payment window. Check your connection (or an ad blocker) and try again.'))
      }
      document.head.appendChild(s)
    })
  return loading
}

export type RazorpayOutcome = { kind: 'paid'; result: RazorpaySuccess } | { kind: 'dismissed' } | { kind: 'failed'; message: string }

/** Opens Razorpay Checkout for a server-created order and resolves once the person pays, fails or closes it. */
export async function openRazorpay(opts: RazorpayOptions): Promise<RazorpayOutcome> {
  const Razorpay = await load()
  return new Promise<RazorpayOutcome>((resolve) => {
    let settled = false
    // Razorpay lets the person retry inside its window after a failure; report the failure only if they then close it.
    let lastFailure: string | null = null
    const finish = (o: RazorpayOutcome) => {
      if (!settled) {
        settled = true
        resolve(o)
      }
    }
    const rz = new Razorpay({
      ...opts,
      handler: (r) => finish({ kind: 'paid', result: r }),
      modal: { ondismiss: () => finish(lastFailure ? { kind: 'failed', message: lastFailure } : { kind: 'dismissed' }), confirm_close: true },
    })
    rz.on('payment.failed', (r) => {
      lastFailure = r.error?.description || r.error?.reason || 'The payment did not go through.'
    })
    rz.open()
  })
}
