const crypto = require('node:crypto')
const fs     = require('node:fs')
const path   = require('node:path')
const os     = require('node:os')

const KEYS_DIR = path.join(os.homedir(), '.messenger', 'keys')

// X25519 DER headers (fixed for 32-byte keys)
const PKCS8_HEADER = Buffer.from('302e020100300506032b656e04220420', 'hex') // 16 bytes
const SPKI_HEADER  = Buffer.from('302a300506032b656e032100', 'hex')          // 12 bytes

function rawToPrivKey(raw32) {
  return crypto.createPrivateKey({ key: Buffer.concat([PKCS8_HEADER, raw32]), format: 'der', type: 'pkcs8' })
}

function rawToPubKey(raw32) {
  return crypto.createPublicKey({ key: Buffer.concat([SPKI_HEADER, raw32]), format: 'der', type: 'spki' })
}

function getOrCreateKeyPair(userId) {
  fs.mkdirSync(KEYS_DIR, { recursive: true })
  const privPath = path.join(KEYS_DIR, `${userId}.priv`)

  let privRaw
  if (fs.existsSync(privPath)) {
    privRaw = Buffer.from(fs.readFileSync(privPath, 'utf8').trim(), 'base64')
  } else {
    const { privateKey } = crypto.generateKeyPairSync('x25519')
    privRaw = privateKey.export({ type: 'pkcs8', format: 'der' }).slice(16, 48)
    fs.writeFileSync(privPath, privRaw.toString('base64'))
  }

  const privKey = rawToPrivKey(privRaw)
  const pubRaw  = crypto.createPublicKey(privKey).export({ type: 'spki', format: 'der' }).slice(12)

  return { privKeyB64: privRaw.toString('base64'), pubKeyB64: pubRaw.toString('base64') }
}

function ecdhDerive(privRaw, peerPubRaw) {
  return crypto.diffieHellman({ privateKey: rawToPrivKey(privRaw), publicKey: rawToPubKey(peerPubRaw) })
}

function aesEncrypt(sharedSecret, plaintext) {
  const key    = crypto.createHash('sha256').update(sharedSecret).digest()
  const nonce  = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce)
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  return Buffer.concat([nonce, enc, tag])
}

function aesDecrypt(sharedSecret, data) {
  const key        = crypto.createHash('sha256').update(sharedSecret).digest()
  const nonce      = data.slice(0, 12)
  const tag        = data.slice(-16)
  const ciphertext = data.slice(12, -16)
  const decipher   = crypto.createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

async function publishPubKey(userId, keyServerUrl) {
  const { pubKeyB64 } = getOrCreateKeyPair(userId)
  const res = await fetch(`${keyServerUrl}/publish`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ user_id: userId, public_key: pubKeyB64 }),
  })
  if (!res.ok) throw new Error(`publish failed: ${res.status}`)
}

// Simple in-memory cache for peer public keys
const pubKeyCache = new Map()

async function fetchAndCachePubKey(userId, keyServerUrl) {
  if (pubKeyCache.has(userId)) return pubKeyCache.get(userId)
  const res  = await fetch(`${keyServerUrl}/${userId}`)
  if (!res.ok) throw new Error(`Key not found for ${userId}`)
  const data = await res.json()
  const raw  = Buffer.from(data.public_key, 'base64')
  pubKeyCache.set(userId, raw)
  return raw
}

module.exports = { getOrCreateKeyPair, ecdhDerive, aesEncrypt, aesDecrypt, fetchAndCachePubKey, publishPubKey }
