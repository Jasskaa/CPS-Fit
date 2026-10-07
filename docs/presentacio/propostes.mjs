// Genera los PDF de la propuesta económica y de la hoja de requisitos.  node docs/presentacio/propostes.mjs
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const emblem = pathToFileURL(path.join(dir, '..', '..', 'public', 'brand', 'emblem-256.webp')).href

const css = `
  @page { size: A4; margin: 18mm 17mm 18mm 17mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0b0d1a; font-size: 10.5pt; line-height: 1.5; margin: 0; }
  header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #2030ff; padding-bottom: 12px; margin-bottom: 18px; }
  header img { width: 58px; height: 58px; border-radius: 50%; }
  header h1 { font-size: 22pt; margin: 0; line-height: 1.1; letter-spacing: .3px; }
  header p { margin: 0; color: #545a74; }
  h2 { font-size: 13pt; margin: 20px 0 6px; color: #2030ff; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #d9dcec; vertical-align: top; }
  th { background: #f5f6fb; font-size: 9.5pt; text-transform: uppercase; letter-spacing: .4px; color: #545a74; }
  td.num { text-align: right; white-space: nowrap; font-weight: 700; }
  .box { background: #f5f6fb; border: 1px solid #d9dcec; border-radius: 8px; padding: 10px 14px; margin: 10px 0; }
  .warn { background: #fff6bf; border-color: #e6d94a; }
  ul { margin: 4px 0 4px 18px; padding: 0; } li { margin: 3px 0; }
  .sign { display: flex; gap: 40px; margin-top: 44px; } .sign div { flex: 1; border-top: 1px solid #0b0d1a; padding-top: 6px; font-size: 9.5pt; color: #545a74; }
  .check li { list-style: none; margin-left: -18px; } .check li::before { content: '☐  '; font-size: 12pt; }
  small { color: #545a74; } .total { font-size: 12pt; }
  footer { margin-top: 22px; font-size: 8.5pt; color: #545a74; border-top: 1px solid #d9dcec; padding-top: 8px; }
`
const head = (title, sub) => `<header><img src="${emblem}" alt=""><div><h1>${title}</h1><p>${sub}</p></div></header>`

const proposta = `<!doctype html><html lang="ca"><meta charset="utf-8"><style>${css}</style><body>
${head('Proposta econòmica', 'CPS Fit · aplicació de rutines i seguiment per al gimnàs del C.P. Santjoanenc')}
<p><strong>Client:</strong> Club Poliesportiu Santjoanenc · C/ Paperera Torras, 2, 17857 Sant Joan les Fonts<br>
<strong>Presentada per:</strong> [nom i cognoms / empresa] · [NIF] · [correu] · [telèfon]<br>
<strong>Data:</strong> 7 d'octubre de 2026 &nbsp;·&nbsp; <strong>Validesa de l'oferta:</strong> 30 dies</p>

<h2>1. Objecte</h2>
<p>Posada en marxa de <strong>CPS Fit</strong>, una aplicació web instal·lable (PWA) per digitalitzar les rutines d'entrenament dels abonats del gimnàs i el seu seguiment: app per al soci (mòbil) i panell per al monitor i l'administració (ordinador o tauleta), en català i castellà, amb la imatge del club.</p>

<h2>2. Què inclou</h2>
<ul>
  <li>App del soci: sessió d'avui, entrenament en directe amb temporitzador, funcionament sense cobertura, progrés, rècords, mesures i fotos opcionals, rutines pròpies, informació del club.</li>
  <li>Panell del monitor: socis, biblioteca d'exercicis (108 inicials), constructor de rutines, plantilles i assignació, seguiment, comentaris, avisos i gestió de monitors.</li>
  <li>Personalització amb el logo, els colors i el contingut propi del club (exercicis, plantilles).</li>
  <li>Configuració dels serveis al nom del club (hosting, base de dades, domini) i càrrega inicial de dades.</li>
  <li>Formació a l'equip de monitors i un pilot amb un grup reduït de socis.</li>
  <li>Documentació d'ús i de migració de dades.</li>
</ul>

<h2>3. Què no inclou</h2>
<ul>
  <li>Pagaments i quotes, reserva de classes, control d'accés i integració amb el programari actual del club (Poliwin). L'aplicació enllaça a la zona de reserves existent; l'arquitectura queda preparada per afegir-ho en el futur.</li>
  <li>Revisió legal del RGPD i dels textos de privacitat (a càrrec del club; orientativament 300–800 €).</li>
  <li>Funcions noves, formació addicional i importacions massives de dades: es pressuposten a part.</li>
</ul>

<h2>4. Preus</h2>
<table>
  <tr><th>Concepte</th><th>Periodicitat</th><th style="text-align:right">Import</th></tr>
  <tr><td><strong>Implantació</strong><br><small>Personalització, càrrega de contingut, formació i posada en marxa</small></td><td>Pagament únic</td><td class="num">2.500,00 €</td></tr>
  <tr><td><strong>Manteniment</strong><br><small>Vigilància del servei, avisos d'incidències, renovació de dominis i claus, petites correccions</small></td><td>Cada 5 mesos</td><td class="num">150,00 €</td></tr>
</table>
<p><small>Imports sense IVA. Forma de pagament proposada: 50 % en acceptar la proposta i 50 % en finalitzar el pilot.</small></p>

<h2>5. Serveis de tercers (a càrrec del club)</h2>
<p>Els serveis es contracten <strong>directament pel club, al seu nom</strong>, perquè les dades dels socis siguin del club i el club controli el cost. Costos orientatius (segons les webs dels proveïdors a l'octubre de 2026; poden variar):</p>
<table>
  <tr><th>Servei</th><th>Per a què</th><th style="text-align:right">Cost orientatiu</th></tr>
  <tr><td>Vercel Pro</td><td>Hosting de l'aplicació (el pla gratuït no permet ús comercial)</td><td class="num">20 $/mes</td></tr>
  <tr><td>Supabase Pro</td><td>Base de dades, autenticació, còpies de seguretat diàries i emmagatzematge (servidors a la UE)</td><td class="num">25 $/mes</td></tr>
  <tr><td>Domini</td><td>Adreça pròpia (p. ex. fit.cpsantjoanenc.org)</td><td class="num">≈ 12 €/any</td></tr>
  <tr class="total"><td colspan="2"><strong>Total aproximat</strong></td><td class="num">≈ 45 $/mes</td></tr>
</table>

<h2>6. Planificació</h2>
<table>
  <tr><td><strong>Setmana 1</strong></td><td>Comptes del club, revisió legal i configuració.</td></tr>
  <tr><td><strong>Setmana 2</strong></td><td>Contingut propi: exercicis, plantilles, logo i colors oficials.</td></tr>
  <tr><td><strong>Setmana 3</strong></td><td>Formació pràctica als monitors.</td></tr>
  <tr><td><strong>Setmana 4</strong></td><td>Pilot amb un grup reduït de socis i, després, obertura a tothom.</td></tr>
</table>
<p><small>Terminis orientatius; depenen que el club aporti comptes, textos i disponibilitat dels monitors.</small></p>

<h2>7. Condicions</h2>
<ul>
  <li><strong>Dades:</strong> les dades dels socis són propietat del club, que és el responsable del tractament. El prestador actua com a encarregat del tractament i signarà el contracte corresponent.</li>
  <li><strong>Propietat i llicència:</strong> el club rep una llicència d'ús de l'aplicació per al seu gimnàs. El codi font es manté propietat del prestador, tret de pacte en contra. El logo i la marca del club són del club.</li>
  <li><strong>Manteniment:</strong> durada mínima de 12 mesos i preavís de 30 dies per cancel·lar. Cobreix el que s'indica a l'apartat 2; la resta es pressuposta a part (tarifa orientativa de 40–50 €/hora).</li>
  <li><strong>Pilot:</strong> el primer termini de manteniment comença en acabar el pilot.</li>
  <li><strong>Dades reals:</strong> no es carregaran dades personals reals de socis fins que el club hagi aprovat el prototip i s'hagi completat la revisió legal.</li>
</ul>

<div class="sign"><div>Pel Club Poliesportiu Santjoanenc<br>Nom, càrrec i data</div><div>Pel prestador<br>Nom i data</div></div>
<footer>CPS Fit · Proposta econòmica · Els imports i les condicions són una proposta i es poden negociar.</footer>
</body></html>`

const requisits = `<!doctype html><html lang="ca"><meta charset="utf-8"><style>${css}</style><body>
${head('Què necessitem del club', 'CPS Fit · llista de requisits per posar en marxa l\'aplicació')}
<p>Aquesta llista recull el que el club ha d'aportar o decidir perquè la implantació vagi bé i dins de termini. Marca cada punt a mesura que es resolgui.</p>

<h2>1. Persones</h2>
<ul class="check">
  <li><strong>Persona de referència</strong> del club per a la implantació (decisions i validacions): ________________________</li>
  <li><strong>Responsable del tractament de dades</strong> i contacte de privacitat (actualment info@cpsantjoanenc.org): ________________________</li>
  <li><strong>Un monitor líder del pilot</strong> que provi l'aplicació amb els seus socis: ________________________</li>
  <li><strong>Persona administradora</strong> de l'aplicació (alta de monitors, validació d'altes): ________________________</li>
</ul>

<h2>2. Comptes i serveis (al nom del club)</h2>
<ul class="check">
  <li>Compte de <strong>Vercel</strong> (pla Pro) amb una persona del club com a propietària i el prestador com a col·laborador.</li>
  <li>Compte de <strong>Supabase</strong> (pla Pro, regió de la UE) amb la mateixa estructura de permisos.</li>
  <li><strong>Domini</strong> o subdomini per a l'aplicació (p. ex. fit.cpsantjoanenc.org) i accés a la gestió de DNS.</li>
  <li>Adreça de correu per als enviaments de l'aplicació (invitacions, confirmacions) i, si cal, servei de correu propi.</li>
  <li>Forma de pagament dels serveis de tercers.</li>
</ul>

<h2>3. Contingut i imatge</h2>
<ul class="check">
  <li>Logo oficial en alta qualitat (idealment vectorial) i colors corporatius exactes.</li>
  <li>Horaris definitius del gimnàs i dels monitors de sala, normes de la sala i dades de contacte.</li>
  <li>Revisió de la biblioteca d'exercicis (108 inicials) i de les plantilles de rutina; exercicis o material propis a afegir.</li>
  <li>Fotos o vídeos dels exercicis, si el club en té i en pot autoritzar l'ús.</li>
  <li>Enllaç actual de reserves i àrea privada del club.</li>
</ul>

<h2>4. Legal i privacitat</h2>
<ul class="check">
  <li>Revisió professional de la <strong>política de privacitat</strong> i dels <strong>termes d'ús</strong> (els actuals són un esborrany).</li>
  <li>Contractes d'encàrrec del tractament (DPA) amb Supabase i Vercel.</li>
  <li>Decisió sobre si cal una <strong>avaluació d'impacte</strong> (EIPD) per tractar dades de salut.</li>
  <li>Registre d'activitats de tractament actualitzat i procediment davant d'una violació de seguretat.</li>
</ul>

<h2>5. Socis i pilot</h2>
<ul class="check">
  <li>Llista de socis participants al pilot (10–15 persones) i el seu consentiment per participar-hi.</li>
  <li>Decisió sobre com es donaran d'alta: <strong>invitació</strong> pel monitor o <strong>registre propi</strong> amb validació del club.</li>
  <li>Data de la sessió de formació als monitors i del llançament a tots els socis.</li>
  <li>Canal on els socis podran demanar ajuda (correu, telèfon, recepció).</li>
</ul>

<div class="box warn"><strong>Important:</strong> fins que el club aprovi el prototip i es completi la revisió legal, l'aplicació només conté dades fictícies. No s'hi carregaran dades reals de socis.</div>
<footer>CPS Fit · Llista de requisits per a la implantació</footer>
</body></html>`

const b = await chromium.launch({ channel: 'msedge' })
for (const [name, html] of [['CPS-Fit-proposta-economica', proposta], ['CPS-Fit-requisits-del-club', requisits]]) {
  writeFileSync(path.join(dir, name + '.html'), html)
  const page = await b.newPage()
  await page.goto(pathToFileURL(path.join(dir, name + '.html')).href)
  await page.pdf({ path: path.join(dir, name + '.pdf'), format: 'A4', printBackground: true, margin: { top: '18mm', bottom: '18mm', left: '17mm', right: '17mm' } })
  console.log('✓', name + '.pdf')
}
await b.close()
