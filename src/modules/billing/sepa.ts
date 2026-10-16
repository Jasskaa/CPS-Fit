// Generador de remesas SEPA de adeudo directo (pain.008.001.02, esquema CORE).
export interface Creditor { name: string; iban: string; creditorId: string; bic?: string }
export interface DebitItem {
  endToEndId: string
  amountCents: number
  debtorName: string
  debtorIban: string
  mandateId: string
  mandateDate: string
  concept: string
  sequence?: 'FRST' | 'RCUR' | 'OOFF' | 'FNAL'
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const amt = (c: number) => (c / 100).toFixed(2)
const clean = (s: string, n: number) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 /\-?:().,'+]/g, ' ').slice(0, n).trim()

/** Valida un IBAN (mod 97). */
export function validIban(iban: string): boolean {
  const s = iban.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false
  const r = s.slice(4) + s.slice(0, 4)
  let rem = 0
  for (const ch of r) {
    const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch
    for (const d of v) rem = (rem * 10 + Number(d)) % 97
  }
  return rem === 1
}

export function buildPain008(opts: { msgId: string; creditor: Creditor; collectionDate: string; items: DebitItem[]; now?: Date }): string {
  const { msgId, creditor, collectionDate, items } = opts
  if (!items.length) throw new Error('empty batch')
  for (const i of items) if (!validIban(i.debtorIban)) throw new Error(`invalid IBAN for ${i.endToEndId}`)
  const total = items.reduce((a, i) => a + i.amountCents, 0)
  const created = (opts.now ?? new Date()).toISOString().slice(0, 19)
  const groups = new Map<string, DebitItem[]>()
  for (const i of items) groups.set(i.sequence ?? 'RCUR', [...(groups.get(i.sequence ?? 'RCUR') ?? []), i])
  const pmt = [...groups.entries()].map(([seq, list], k) => `
      <PmtInf>
        <PmtInfId>${esc(msgId)}-${k + 1}</PmtInfId>
        <PmtMtd>DD</PmtMtd>
        <NbOfTxs>${list.length}</NbOfTxs>
        <CtrlSum>${amt(list.reduce((a, i) => a + i.amountCents, 0))}</CtrlSum>
        <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>${seq}</SeqTp></PmtTpInf>
        <ReqdColltnDt>${collectionDate}</ReqdColltnDt>
        <Cdtr><Nm>${esc(clean(creditor.name, 70))}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${creditor.iban.replace(/\s+/g, '')}</IBAN></Id></CdtrAcct>
        <CdtrAgt><FinInstnId>${creditor.bic ? `<BIC>${creditor.bic}</BIC>` : '<Othr><Id>NOTPROVIDED</Id></Othr>'}</FinInstnId></CdtrAgt>
        <ChrgBr>SLEV</ChrgBr>
        <CdtrSchmeId><Id><PrvtId><Othr><Id>${esc(creditor.creditorId)}</Id><SchmeNm><Prtry>SEPA</Prtry></SchmeNm></Othr></PrvtId></Id></CdtrSchmeId>${list.map((i) => `
        <DrctDbtTxInf>
          <PmtId><EndToEndId>${esc(clean(i.endToEndId, 35))}</EndToEndId></PmtId>
          <InstdAmt Ccy="EUR">${amt(i.amountCents)}</InstdAmt>
          <DrctDbtTx><MndtRltdInf><MndtId>${esc(clean(i.mandateId, 35))}</MndtId><DtOfSgntr>${i.mandateDate}</DtOfSgntr></MndtRltdInf></DrctDbtTx>
          <DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>
          <Dbtr><Nm>${esc(clean(i.debtorName, 70))}</Nm></Dbtr>
          <DbtrAcct><Id><IBAN>${i.debtorIban.replace(/\s+/g, '')}</IBAN></Id></DbtrAcct>
          <RmtInf><Ustrd>${esc(clean(i.concept, 140))}</Ustrd></RmtInf>
        </DrctDbtTxInf>`).join('')}
      </PmtInf>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${esc(msgId)}</MsgId>
      <CreDtTm>${created}</CreDtTm>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${amt(total)}</CtrlSum>
      <InitgPty><Nm>${esc(clean(creditor.name, 70))}</Nm></InitgPty>
    </GrpHdr>${pmt}
  </CstmrDrctDbtInitn>
</Document>
`
}
