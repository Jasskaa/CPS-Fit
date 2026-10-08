// Pantallas de arranque (splash) para iOS a partir del emblema del club.
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
const sizes = [[750, 1334, 375, 667, 2], [1125, 2436, 375, 812, 3], [828, 1792, 414, 896, 2], [1242, 2688, 414, 896, 3], [1170, 2532, 390, 844, 3], [1179, 2556, 393, 852, 3], [1284, 2778, 428, 926, 3], [1290, 2796, 430, 932, 3]]
const emblem = await sharp('public/brand/emblem.png').resize(360).toBuffer()
const list = []
for (const [w, h, cw, ch, r] of sizes) {
  const file = `splash-${w}x${h}.png`
  await sharp({ create: { width: w, height: h, channels: 4, background: '#090b16' } })
    .composite([{ input: emblem, gravity: 'center' }]).png({ compressionLevel: 9 }).toFile(`public/icons/${file}`)
  list.push({ url: `/icons/${file}`, media: `(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)` })
}
writeFileSync('src/lib/splash.json', JSON.stringify(list, null, 2) + '\n')
console.log('splash ok', list.length)
