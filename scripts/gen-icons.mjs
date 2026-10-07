// Genera emblema con fondo transparente e iconos PWA a partir del logo oficial.
import sharp from 'sharp'
const SRC = 'public/brand/logo-cps.jpg'
const crop = { left: 54, top: 398, width: 3870, height: 3816 }
const S = 1024
const mask = Buffer.from(`<svg width="${S}" height="${S}"><ellipse cx="${S / 2}" cy="${S / 2}" rx="${S / 2 - 3}" ry="${S / 2 - 3}" fill="#fff"/></svg>`)
const emblem = await sharp(SRC).extract(crop).resize(S, S, { fit: 'fill' })
  .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
await sharp(emblem).toFile('public/brand/emblem.png')
await sharp(emblem).resize(256, 256).webp({ quality: 90 }).toFile('public/brand/emblem-256.webp')
const icon = async (size, pad, bg) => sharp({ create: { width: size, height: size, channels: 4, background: bg } })
  .composite([{ input: await sharp(emblem).resize(Math.round(size * (1 - pad * 2))).toBuffer(), gravity: 'center' }]).png()
await (await icon(192, 0.06, { r: 0, g: 0, b: 0, alpha: 0 })).toFile('public/icons/icon-192.png')
await (await icon(512, 0.06, { r: 0, g: 0, b: 0, alpha: 0 })).toFile('public/icons/icon-512.png')
await (await icon(512, 0.2, { r: 31, g: 47, b: 255, alpha: 1 })).toFile('public/icons/maskable-512.png')
await (await icon(180, 0.14, { r: 31, g: 47, b: 255, alpha: 1 })).toFile('public/icons/apple-touch-icon.png')
await sharp('public/brand/logo-cps.jpg').resize(1200).webp({ quality: 88 }).toFile('public/brand/logo-cps.webp')
console.log('icons ok')
