/** GST state codes (first two digits of a GSTIN). 96 = outside India (export, zero-rated). Shared by the invoice editor, the client form and the mock server. */
export const GST_STATES: { code: string; name: string }[] = [
  ['01', 'Jammu and Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'], ['06', 'Haryana'], ['07', 'Delhi'],
  ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'], ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'],
  ['16', 'Tripura'], ['17', 'Meghalaya'], ['18', 'Assam'], ['19', 'West Bengal'], ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'], ['26', 'Dadra and Nagar Haveli and Daman and Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'], ['31', 'Lakshadweep'], ['32', 'Kerala'],
  ['33', 'Tamil Nadu'], ['34', 'Puducherry'], ['35', 'Andaman and Nicobar Islands'], ['36', 'Telangana'], ['37', 'Andhra Pradesh'], ['38', 'Ladakh'], ['97', 'Other Territory'],
  ['96', 'Outside India (export)'],
].map(([code, name]) => ({ code, name }))

/** V9-FIX: the first thing wrong with a GSTIN (mirrors backend app/domain/gst.py gstin_problem — the server has the
 *  final say); null when it is well formed. */
export const GSTIN_EXAMPLE = '21AAKFM9876Q1ZB'
export function gstinProblem(raw: string): string | null {
  const g = raw.trim().toUpperCase()
  if (g.length !== 15) return `A GSTIN has 15 characters; this one has ${g.length}. Example: ${GSTIN_EXAMPLE}.`
  const bad = [...g].find((c) => !/[0-9A-Z]/.test(c))
  if (bad) return `A GSTIN has only capital letters and digits; remove “${bad}”.`
  const sc = Number(g.slice(0, 2))
  if (!/^\d{2}$/.test(g.slice(0, 2)) || !((sc >= 1 && sc <= 38) || sc === 96 || sc === 97 || sc === 99)) return `A GSTIN starts with the 2-digit state code (01–38, 96, 97 or 99); “${g.slice(0, 2)}” is not a state code.`
  const pan = g.slice(2, 12)
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) return `Characters 3–12 of a GSTIN are the PAN (5 letters, 4 digits, 1 letter); “${pan}” is not a valid PAN.`
  if (g[12] === '0') return 'Character 13 of a GSTIN is the registration number under this PAN (1–9 or A–Z); it can’t be 0.'
  if (g[13] !== 'Z') return `Character 14 of a GSTIN is always “Z”; this one has “${g[13]}”.`
  return null
}
