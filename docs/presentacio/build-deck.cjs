// Genera docs/presentacio/CPS-Fit-presentacio.pptx  ·  node docs/presentacio/build-deck.cjs
const path = require('path')
const pptxgen = require('pptxgenjs')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const sharp = require('sharp')
const fa = require('react-icons/fa')

const IMG = (f) => path.join(__dirname, 'img', f)
const BRAND = (f) => path.join(__dirname, '..', '..', 'public', 'brand', f)
const OUT = path.join(__dirname, 'CPS-Fit-presentacio.pptx')

const C = { dark: '0B0D1A', blue: '2030FF', blueSoft: 'E6E8FF', yellow: 'F8F800', white: 'FFFFFF', bg: 'F5F6FB', ink: '0B0D1A', muted: '545A74', line: 'D9DCEC', green: '0B7A45', red: 'C3261F' }
const H = 'Arial', B = 'Calibri'

async function icon(name, color) {
  const svg = renderToStaticMarkup(React.createElement(fa[name], { color: '#' + color, size: 256 }))
  const png = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer()
  return 'image/png;base64,' + png.toString('base64')
}

async function main() {
  const pres = new pptxgen()
  pres.layout = 'LAYOUT_16x9' // 10 x 5.625
  pres.title = 'CPS Fit · Proposta per al C.P. Santjoanenc'
  pres.author = 'CPS Fit'
  pres.company = 'CPS Fit'

  const W = 10, Hh = 5.625
  const title = (s, text, o = {}) =>
    s.addText(text, { x: 0.6, y: 0.4, w: o.w || 8.8, h: o.h || 0.8, fontFace: H, fontSize: o.size || 32, bold: true, color: o.color || C.ink, margin: 0, valign: 'top', isTextBox: true, objectName: 'Títol' })
  const iconCircle = async (s, name, x, y, d, bg, fg) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg }, objectName: 'Cercle icona' })
    const pad = d * 0.27
    s.addImage({ data: await icon(name, fg), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad, altText: name })
  }
  const frame = (s, file, x, y, w, h, shadow = true) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.06, y: y - 0.06, w: w + 0.12, h: h + 0.12, rectRadius: 0.12, fill: { color: C.white }, line: { color: C.line, width: 0.75 }, shadow: shadow ? { type: 'outer', color: '000000', opacity: 0.18, blur: 10, offset: 3, angle: 90 } : undefined, objectName: 'Marc captura' })
    s.addImage({ path: IMG(file), x, y, w, h, altText: 'Captura de la app CPS Fit' })
  }

  // 1 · Portada ───────────────────────────────────────────────
  let s = pres.addSlide()
  s.background = { color: C.dark }
  s.addImage({ path: BRAND('emblem.png'), x: 5.9, y: 0.95, w: 3.6, h: 3.6, altText: 'Escut del C.P. Santjoanenc' })
  s.addText([{ text: 'CPS ', options: { color: C.white } }, { text: 'Fit', options: { color: C.yellow } }], { x: 0.7, y: 1.3, w: 5.2, h: 1.1, fontFace: H, fontSize: 66, bold: true, margin: 0, isTextBox: true, valign: 'top', objectName: 'Títol' })
  s.addText('El teu entrenament, al teu club.', { x: 0.7, y: 2.55, w: 5, h: 0.5, fontFace: B, fontSize: 22, color: 'CADCFC', margin: 0, isTextBox: true })
  s.addText('Proposta d\'aplicació de rutines i seguiment per al gimnàs del Club Poliesportiu Santjoanenc', { x: 0.7, y: 3.35, w: 4.9, h: 0.9, fontFace: B, fontSize: 16, color: C.white, margin: 0, isTextBox: true })
  s.addText('Octubre de 2026', { x: 0.7, y: 4.85, w: 4, h: 0.3, fontFace: B, fontSize: 12, color: '9AA4D8', margin: 0, isTextBox: true })
  s.addNotes('Obertura. Frase clau: "Avui la rutina de cada soci és un paper. Us proposem digitalitzar-la, amb la imatge del club i en català."')

  // 2 · El punt de partida ───────────────────────────────────
  s = pres.addSlide(); s.background = { color: C.bg }
  title(s, 'Avui, la rutina és un paper')
  const rows = [
    ['FaRegFileAlt', 'Es perd, s\'espatlla o queda desactualitzada', 'Cada canvi de rutina vol dir tornar a escriure-la a mà.'],
    ['FaEyeSlash', 'El monitor no veu l\'evolució', 'Sense dades, és difícil saber qui progressa i qui ha deixat de venir.'],
    ['FaHistory', 'El soci no recorda què va fer l\'última vegada', 'Els pesos i repeticions es perden entre sessió i sessió.'],
  ]
  for (let i = 0; i < rows.length; i++) {
    const y = 1.55 + i * 1.2
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y, w: 8.8, h: 1.0, rectRadius: 0.1, fill: { color: C.white }, line: { color: C.line, width: 0.75 }, shadow: { type: 'outer', color: '000000', opacity: 0.08, blur: 6, offset: 2, angle: 90 }, objectName: 'Targeta' })
    await iconCircle(s, rows[i][0], 0.85, y + 0.17, 0.66, C.blueSoft, C.blue)
    s.addText(rows[i][1], { x: 1.75, y: y + 0.12, w: 7.4, h: 0.4, fontFace: H, fontSize: 18, bold: true, color: C.ink, margin: 0, isTextBox: true })
    s.addText(rows[i][2], { x: 1.75, y: y + 0.52, w: 7.4, h: 0.35, fontFace: B, fontSize: 14, color: C.muted, margin: 0, isTextBox: true })
  }
  s.addNotes('Tots els abonats reben assessorament i una rutina personalitzada. És la base del servei i avui es fa en paper. La proposta digitalitza exactament això, no el substitueix.')

  // 3 · La solució ───────────────────────────────────────────
  s = pres.addSlide(); s.background = { color: C.white }
  title(s, 'Una app per al soci, un panell per al monitor')
  const cols = [
    ['FaMobileAlt', 'App del soci', 'S\'instal·la al mòbil, sense botiga d\'apps', ['La rutina que li ha preparat el monitor', 'Entrena amb temporitzador de descans', 'Veu el seu progrés i els seus rècords']],
    ['FaDesktop', 'Panell del monitor', 'Es fa servir des de l\'ordinador o la tauleta', ['Crea i assigna rutines en pocs clics', 'Segueix l\'assistència i l\'evolució', 'Respon dubtes i publica avisos']],
  ]
  for (let i = 0; i < 2; i++) {
    const x = 0.6 + i * 4.5
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.5, w: 4.3, h: 3.6, rectRadius: 0.12, fill: { color: C.bg }, line: { color: C.line, width: 0.75 }, objectName: 'Targeta' })
    await iconCircle(s, cols[i][0], x + 0.3, 1.75, 0.8, C.blue, C.white)
    s.addText(cols[i][1], { x: x + 1.3, y: 1.78, w: 2.8, h: 0.4, fontFace: H, fontSize: 20, bold: true, color: C.ink, margin: 0, isTextBox: true })
    s.addText(cols[i][2], { x: x + 1.3, y: 2.2, w: 2.8, h: 0.45, fontFace: B, fontSize: 12, color: C.muted, margin: 0, isTextBox: true, valign: 'top' })
    s.addText(cols[i][3].map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < 2 } })), { x: x + 0.3, y: 3.1, w: 3.8, h: 1.8, fontFace: B, fontSize: 15, color: C.ink, margin: 0, paraSpaceAfter: 8, valign: 'top', isTextBox: true })
  }
  s.addNotes('Dues experiències dins del mateix projecte. El monitor treballa a l\'ordinador; el soci, al mòbil. Si un monitor entra des del mòbil, veu un avís que el panell és només per a ordinador o tauleta.')

  // 4 · El soci ─────────────────────────────────────────────
  s = pres.addSlide(); s.background = { color: C.bg }
  title(s, 'El soci entrena sense pensar', { w: 4.6, h: 1.1, size: 30 })
  s.addText([
    { text: 'La sessió d\'avui, amb un sol botó', options: { bullet: true, breakLine: true } },
    { text: 'Registra pes i repeticions i veu l\'última vegada', options: { bullet: true, breakLine: true } },
    { text: 'Descans automàtic amb avís sonor i vibració', options: { bullet: true, breakLine: true } },
    { text: 'Rècords personals i ratxa setmanal', options: { bullet: true, breakLine: true } },
    { text: 'Pot crear o duplicar les seves pròpies rutines', options: { bullet: true } },
  ], { x: 0.6, y: 1.85, w: 4.5, h: 3.3, fontFace: B, fontSize: 16, color: C.ink, margin: 0, paraSpaceAfter: 10, valign: 'top', isTextBox: true })
  frame(s, 'm-inici.png', 5.45, 0.45, 1.97, 4.04)
  frame(s, 'm-entreno.png', 7.6, 0.95, 1.97, 4.04)
  s.addNotes('DEMO (2 min): obrir l\'app al mòbil → botó "Començar entrenament" → marcar una sèrie → es veu el temporitzador de descans → acabar i veure el resum amb rècords.')

  // 5 · El monitor ───────────────────────────────────────────
  s = pres.addSlide(); s.background = { color: C.white }
  title(s, 'El monitor ho té tot controlat')
  s.addText([
    { text: 'Constructor de rutines: arrossega i deixa anar', options: { bullet: true, breakLine: true } },
    { text: '108 exercicis en català i castellà, editables', options: { bullet: true, breakLine: true } },
    { text: 'Plantilles i assignació a diversos socis alhora', options: { bullet: true, breakLine: true } },
    { text: 'Versions de rutina sense perdre l\'historial', options: { bullet: true, breakLine: true } },
    { text: 'Comentaris amb els socis i avisos del gimnàs', options: { bullet: true } },
  ], { x: 0.6, y: 1.5, w: 3.6, h: 3.5, fontFace: B, fontSize: 16, color: C.ink, margin: 0, paraSpaceAfter: 10, valign: 'top', isTextBox: true })
  frame(s, 'd-constructor.png', 4.45, 1.45, 5.0, 3.01)
  s.addText('Cada monitor només veu els seus socis; l\'administració ho veu tot.', { x: 4.45, y: 4.75, w: 5, h: 0.5, fontFace: B, fontSize: 12, italic: true, color: C.muted, margin: 0, isTextBox: true })
  s.addNotes('DEMO (3 min): iniciar sessió com a monitor → Rutines → obrir una plantilla → afegir un exercici → desar. Després, ficha d\'un soci → assignar plantilla.')

  // 6 · Seguiment ────────────────────────────────────────────
  s = pres.addSlide(); s.background = { color: C.bg }
  title(s, 'Seguiment amb dades, no a ull', { w: 5.0, h: 1.1, size: 30 })
  const stats = [['108', 'exercicis de sala'], ['5', 'plantilles de rutina'], ['2', 'idiomes: català i castellà']]
  stats.forEach(([n, l], i) => {
    const x = 0.6 + i * 1.5
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.65, w: 1.38, h: 1.5, rectRadius: 0.1, fill: { color: C.white }, line: { color: C.line, width: 0.75 }, objectName: 'Dada' })
    s.addText(n, { x, y: 1.75, w: 1.38, h: 0.75, fontFace: H, fontSize: 40, bold: true, color: C.blue, align: 'center', margin: 0, isTextBox: true })
    s.addText(l, { x: x + 0.08, y: 2.5, w: 1.22, h: 0.55, fontFace: B, fontSize: 12, color: C.muted, align: 'center', margin: 0, isTextBox: true, valign: 'top' })
  })
  s.addText([
    { text: 'Gràfiques per exercici i 1RM estimat', options: { bullet: true, breakLine: true } },
    { text: 'Assistència i adherència a la rutina', options: { bullet: true, breakLine: true } },
    { text: 'Mesures corporals i fotos opcionals i privades', options: { bullet: true, breakLine: true } },
    { text: 'Socis que fa dies que no vénen, a la vista', options: { bullet: true } },
  ], { x: 0.6, y: 3.4, w: 4.9, h: 1.9, fontFace: B, fontSize: 14, color: C.ink, margin: 0, paraSpaceAfter: 8, valign: 'top', isTextBox: true })
  frame(s, 'm-progres.png', 6.2, 0.4, 2.45, 5.02)
  s.addNotes('Dades de la demo: tots ficticis. El tauler del monitor avisa dels socis que porten 7 o més dies sense venir i de les rutines que caduquen.')

  // 7 · Offline ──────────────────────────────────────────────
  s = pres.addSlide(); s.background = { color: C.dark }
  title(s, 'Funciona també sense cobertura', { color: C.white })
  const steps = [
    ['FaWifi', 'Amb xarxa', 'L\'app desa la rutina al mòbil del soci.'],
    ['FaDumbbell', 'Sense xarxa', 'Entrena i registra les sèries amb normalitat.'],
    ['FaSyncAlt', 'En recuperar-la', 'Els entrenaments s\'envien sols, sense duplicats.'],
  ]
  for (let i = 0; i < 3; i++) {
    const x = 0.6 + i * 3.05
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.6, w: 2.8, h: 2.6, rectRadius: 0.12, fill: { color: '151937' }, line: { color: '2A3070', width: 0.75 }, objectName: 'Pas' })
    await iconCircle(s, steps[i][0], x + 0.25, 1.85, 0.75, C.yellow, C.dark)
    s.addText(String(i + 1), { x: x + 2.1, y: 1.8, w: 0.5, h: 0.5, fontFace: H, fontSize: 28, bold: true, color: '3A44A0', align: 'right', margin: 0, isTextBox: true })
    s.addText(steps[i][1], { x: x + 0.25, y: 2.8, w: 2.4, h: 0.4, fontFace: H, fontSize: 18, bold: true, color: C.white, margin: 0, isTextBox: true })
    s.addText(steps[i][2], { x: x + 0.25, y: 3.25, w: 2.35, h: 0.8, fontFace: B, fontSize: 14, color: 'CADCFC', margin: 0, isTextBox: true, valign: 'top' })
  }
  s.addText('Verificat amb proves automàtiques que tallen la connexió durant l\'entrenament.', { x: 0.6, y: 4.6, w: 8.8, h: 0.4, fontFace: B, fontSize: 13, italic: true, color: '9AA4D8', margin: 0, isTextBox: true })
  s.addNotes('Argument de venda: al gimnàs sovint hi ha poca cobertura. DEMO: posar el mòbil en mode avió, entrenar, tornar a activar la xarxa i veure que l\'entrenament apareix al panell.')

  // 8 · Privadesa ────────────────────────────────────────────
  s = pres.addSlide(); s.background = { color: C.white }
  title(s, 'Privacitat des del primer dia')
  const priv = [
    ['FaGlobeEurope', 'Dades a la Unió Europea', 'Servidors a París.'],
    ['FaUserLock', 'Cada soci, només el seu', 'Els monitors, només els seus socis.'],
    ['FaCheckCircle', 'Consentiment explícit', 'En l\'alta, amb data registrada.'],
    ['FaFileExport', 'Exportar i esborrar', 'El soci descarrega les seves dades o elimina el compte.'],
  ]
  for (let i = 0; i < 4; i++) {
    const x = 0.6 + (i % 2) * 4.5, y = 1.5 + Math.floor(i / 2) * 1.55
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 4.3, h: 1.35, rectRadius: 0.1, fill: { color: C.bg }, line: { color: C.line, width: 0.75 }, objectName: 'Targeta' })
    await iconCircle(s, priv[i][0], x + 0.25, y + 0.3, 0.75, C.blue, C.white)
    s.addText(priv[i][1], { x: x + 1.2, y: y + 0.28, w: 2.95, h: 0.4, fontFace: H, fontSize: 16, bold: true, color: C.ink, margin: 0, isTextBox: true })
    s.addText(priv[i][2], { x: x + 1.2, y: y + 0.68, w: 2.95, h: 0.55, fontFace: B, fontSize: 13, color: C.muted, margin: 0, isTextBox: true, valign: 'top' })
  }
  s.addText('Els textos legals actuals són un esborrany: caldrà una revisió professional abans d\'usar dades reals.', { x: 0.6, y: 4.75, w: 8.8, h: 0.45, fontFace: B, fontSize: 13, italic: true, color: C.muted, margin: 0, isTextBox: true })
  s.addNotes('Sigues clar: avui només hi ha dades ficticies. Abans de carregar socis reals cal la revisió legal i els contractes d\'encarregat del tractament amb els proveïdors.')

  // 9 · Abast ────────────────────────────────────────────────
  s = pres.addSlide(); s.background = { color: C.bg }
  title(s, 'Què inclou i què no')
  const inc = ['App del soci instal·lable', 'Panell del monitor i administració', 'Biblioteca de 108 exercicis i 5 plantilles', 'Català i castellà, mode clar i fosc', 'Funcionament sense cobertura']
  const exc = ['Pagaments i quotes', 'Reserva de classes', 'Control d\'accés / torn', 'Integració amb Poliwin']
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 1.45, w: 4.3, h: 3.5, rectRadius: 0.12, fill: { color: C.white }, line: { color: C.line, width: 0.75 }, objectName: 'Targeta inclou' })
  s.addText('Inclou', { x: 0.9, y: 1.6, w: 3.7, h: 0.45, fontFace: H, fontSize: 20, bold: true, color: C.green, margin: 0, isTextBox: true })
  for (let i = 0; i < inc.length; i++) {
    s.addImage({ data: await icon('FaCheckCircle', C.green), x: 0.9, y: 2.22 + i * 0.5, w: 0.26, h: 0.26, altText: 'Inclòs' })
    s.addText(inc[i], { x: 1.3, y: 2.15 + i * 0.5, w: 3.4, h: 0.4, fontFace: B, fontSize: 14, color: C.ink, margin: 0, isTextBox: true, valign: 'middle' })
  }
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.1, y: 1.45, w: 4.3, h: 3.5, rectRadius: 0.12, fill: { color: C.white }, line: { color: C.line, width: 0.75 }, objectName: 'Targeta no inclou' })
  s.addText('No inclou (de moment)', { x: 5.4, y: 1.6, w: 3.7, h: 0.45, fontFace: H, fontSize: 20, bold: true, color: C.red, margin: 0, isTextBox: true })
  for (let i = 0; i < exc.length; i++) {
    s.addImage({ data: await icon('FaTimesCircle', C.red), x: 5.4, y: 2.22 + i * 0.5, w: 0.26, h: 0.26, altText: 'No inclòs' })
    s.addText(exc[i], { x: 5.8, y: 2.15 + i * 0.5, w: 3.4, h: 0.4, fontFace: B, fontSize: 14, color: C.ink, margin: 0, isTextBox: true, valign: 'middle' })
  }
  s.addText('L\'app enllaça a la zona de reserves actual del club. L\'arquitectura està preparada per afegir-ho més endavant.', { x: 5.4, y: 4.2, w: 3.8, h: 0.65, fontFace: B, fontSize: 12, italic: true, color: C.muted, margin: 0, isTextBox: true, valign: 'top' })
  s.addNotes('No substituïm el sistema de reserves ni de pagaments del club. L\'app hi enllaça des de la pestanya "Club".')

  // 10 · Pla ─────────────────────────────────────────────────
  s = pres.addSlide(); s.background = { color: C.white }
  title(s, 'Posada en marxa en 4 setmanes')
  const plan = [
    ['Setmana 1', 'Comptes i legal', 'Comptes del club als proveïdors i revisió legal dels textos.'],
    ['Setmana 2', 'Contingut propi', 'Exercicis, plantilles, logo i colors oficials del club.'],
    ['Setmana 3', 'Formació', 'Sessió pràctica amb els monitors de sala.'],
    ['Setmana 4', 'Pilot', 'Un grup reduït de socis; després, obertura a tothom.'],
  ]
  s.addShape(pres.shapes.LINE, { x: 1.1, y: 2.15, w: 7.8, h: 0, line: { color: C.line, width: 2 }, objectName: 'Línia temps' })
  for (let i = 0; i < 4; i++) {
    const x = 0.6 + i * 2.3
    s.addShape(pres.shapes.OVAL, { x: x + 0.6, y: 1.8, w: 0.7, h: 0.7, fill: { color: C.blue }, line: { color: C.white, width: 3 }, objectName: 'Fita' })
    s.addText(String(i + 1), { x: x + 0.6, y: 1.8, w: 0.7, h: 0.7, fontFace: H, fontSize: 20, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0, isTextBox: true })
    s.addText(plan[i][0], { x, y: 2.75, w: 1.95, h: 0.3, fontFace: B, fontSize: 12, bold: true, color: C.blue, align: 'center', margin: 0, isTextBox: true })
    s.addText(plan[i][1], { x, y: 3.05, w: 1.95, h: 0.4, fontFace: H, fontSize: 16, bold: true, color: C.ink, align: 'center', margin: 0, isTextBox: true })
    s.addText(plan[i][2], { x: x + 0.05, y: 3.5, w: 1.85, h: 1.2, fontFace: B, fontSize: 13, color: C.muted, align: 'center', margin: 0, isTextBox: true, valign: 'top' })
  }
  s.addNotes('Els terminis són orientatius i depenen de la rapidesa del club en aportar comptes, textos i monitors disponibles per a la formació.')

  // 11 · Inversió ────────────────────────────────────────────
  s = pres.addSlide(); s.background = { color: C.bg }
  title(s, 'Inversió')
  const price = [
    ['FaRocket', 'Implantació', '2.500 €', 'pagament únic', 'Personalització, càrrega de contingut, formació i posada en marxa.'],
    ['FaTools', 'Manteniment', '150 €', 'cada 5 mesos', 'Vigilància del servei, avisos d\'incidències i petites correccions.'],
    ['FaServer', 'Serveis al club', '≈ 45 $/mes', 'a càrrec del club', 'Hosting (Vercel Pro) i base de dades (Supabase Pro) al nom del club.'],
  ]
  for (let i = 0; i < 3; i++) {
    const x = 0.6 + i * 3.05, hl = i === 0
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.4, w: 2.8, h: 3.35, rectRadius: 0.12, fill: { color: hl ? C.blue : C.white }, line: { color: hl ? C.blue : C.line, width: 0.75 }, shadow: { type: 'outer', color: '000000', opacity: 0.12, blur: 8, offset: 3, angle: 90 }, objectName: 'Preu' })
    await iconCircle(s, price[i][0], x + 0.25, 1.62, 0.6, hl ? C.yellow : C.blueSoft, hl ? C.dark : C.blue)
    s.addText(price[i][1], { x: x + 1.0, y: 1.72, w: 1.7, h: 0.4, fontFace: H, fontSize: 16, bold: true, color: hl ? C.white : C.ink, margin: 0, isTextBox: true })
    s.addText(price[i][2], { x: x + 0.25, y: 2.4, w: 2.4, h: 0.65, fontFace: H, fontSize: i === 2 ? 28 : 34, bold: true, color: hl ? C.white : C.blue, margin: 0, isTextBox: true })
    s.addText(price[i][3], { x: x + 0.25, y: 3.05, w: 2.4, h: 0.3, fontFace: B, fontSize: 13, bold: true, color: hl ? C.yellow : C.muted, margin: 0, isTextBox: true })
    s.addText(price[i][4], { x: x + 0.25, y: 3.5, w: 2.35, h: 1.1, fontFace: B, fontSize: 13, color: hl ? 'E6E8FF' : C.muted, margin: 0, isTextBox: true, valign: 'top' })
  }
  s.addText('IVA no inclòs. La revisió legal del RGPD (aprox. 300–800 €) la contracta el club. Funcions noves o formació addicional, a part.', { x: 0.6, y: 4.95, w: 8.8, h: 0.45, fontFace: B, fontSize: 12, italic: true, color: C.muted, margin: 0, isTextBox: true })
  s.addNotes('Els serveis es contracten directament amb els proveïdors, al nom del club: així les dades dels socis són del club i el club controla el cost. Preus dels serveis segons les seves webs en data d\'octubre de 2026; poden variar.')

  // 12 · Propers passos ──────────────────────────────────────
  s = pres.addSlide(); s.background = { color: C.dark }
  title(s, 'Propers passos', { color: C.white })
  const next = ['Decidir si fem un pilot amb el club', 'Signar la proposta i crear els comptes del club', 'Revisió legal i càrrega del contingut propi']
  for (let i = 0; i < 3; i++) {
    const y = 1.6 + i * 0.95
    s.addShape(pres.shapes.OVAL, { x: 0.6, y, w: 0.65, h: 0.65, fill: { color: C.yellow }, line: { color: C.yellow }, objectName: 'Número' })
    s.addText(String(i + 1), { x: 0.6, y, w: 0.65, h: 0.65, fontFace: H, fontSize: 22, bold: true, color: C.dark, align: 'center', valign: 'middle', margin: 0, isTextBox: true })
    s.addText(next[i], { x: 1.5, y, w: 5.2, h: 0.65, fontFace: B, fontSize: 18, color: C.white, margin: 0, valign: 'middle', isTextBox: true })
  }
  s.addImage({ path: BRAND('emblem.png'), x: 7.3, y: 1.55, w: 2.1, h: 2.1, altText: 'Escut del C.P. Santjoanenc' })
  s.addText('Contacte: [nom i cognoms] · [correu] · [telèfon]', { x: 0.6, y: 4.85, w: 8.8, h: 0.35, fontFace: B, fontSize: 14, color: '9AA4D8', margin: 0, isTextBox: true })
  s.addNotes('Acaba proposant una data concreta per al pilot. Deixa la demo instal·lada al mòbil per si volen provar-la.')

  await pres.writeFile({ fileName: OUT })
  console.log('OK', OUT)
}
main().catch((e) => { console.error(e); process.exit(1) })
