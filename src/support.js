'use strict'

const mh = require('multihashing')
const forge = require('node-forge')
const lp = require('pull-length-prefixed')
const pull = require('pull-stream')

exports.exchanges = [
  'P-256',
  'P-384',
  'P-521'
]

exports.ciphers = [
  'AES-256',
  'AES-128'
]

exports.hashes = [
  'SHA256',
  'SHA512'
]

// Determines which algorithm to use.  Note:  f(a, b) = f(b, a)
exports.theBest = (order, p1, p2) => {
  let first
  let second

  if (order < 0) {
    first = p2
    second = p1
  } else if (order > 0) {
    first = p1
    second = p2
  } else {
    return p1[0]
  }

  for (let firstCandidate of first) {
    for (let secondCandidate of second) {
      if (firstCandidate === secondCandidate) {
        return firstCandidate
      }
    }
  }

  throw new Error('No algorithms in common!')
}

exports.makeMacAndCipher = (target) => {
  target.mac = makeMac(target.hashT, target.keys.macKey)
  target.cipher = makeCipher(target.cipherT, target.keys.iv, target.keys.cipherKey)
}

const hashMap = {
  SHA1: 'sha1',
  SHA256: 'sha256',
  // workaround for https://github.com/digitalbazaar/forge/issues/401
  SHA512: forge.md.sha512.create()
}

const toForgeBuffer = exports.toForgeBuffer = (buf) => (
  forge.util.createBuffer(buf.toString('binary'))
)

function makeMac (hashType, key) {
  const hash = hashMap[hashType]

  if (!hash) {
    throw new Error(`unsupported hash type: ${hashType}`)
  }

  const mac = forge.hmac.create()
  mac.start(hash, toForgeBuffer(key))
  return mac
}

function makeCipher (cipherType, iv, key) {
  if (cipherType === 'AES-128' || cipherType === 'AES-256') {
    // aes in counter (CTR) mode because that is what
    // is used in go (cipher.NewCTR)
    const cipher = forge.cipher.createCipher('AES-CTR', toForgeBuffer(key))
    cipher.start({iv: toForgeBuffer(iv)})
    return cipher
  }

  // TODO: Blowfish is not supported in node-forge, figure out if
  // it's needed and if so find a library for it.

  throw new Error(`unrecognized cipher type: ${cipherType}`)
}

exports.randomBytes = (nonceSize) => {
  return new Buffer(forge.random.getBytesSync(nonceSize), 'binary')
}

exports.selectBest = (local, remote) => {
  const oh1 = exports.digest(Buffer.concat([
    remote.pubKeyBytes,
    local.nonce
  ]))
  const oh2 = exports.digest(Buffer.concat([
    local.pubKeyBytes,
    remote.nonce
  ]))
  const order = Buffer.compare(oh1, oh2)

  if (order === 0) {
    throw new Error('you are trying to talk to yourself')
  }

  return {
    curveT: exports.theBest(order, local.exchanges, remote.exchanges),
    cipherT: exports.theBest(order, local.ciphers, remote.ciphers),
    hashT: exports.theBest(order, local.hashes, remote.hashes),
    order
  }
}

exports.digest = (buf) => {
  return mh.digest(buf, 'sha2-256', buf.length)
}

exports.write = function write (state, msg, cb) {
  cb = cb || (() => {})
  pull(
    pull.values([
      msg
    ]),
    lp.encode({fixed: true, bytes: 4}),
    pull.collect((err, res) => {
      if (err) {
        return cb(err)
      }
      state.shake.write(res[0])
      cb()
    })
  )
}

exports.read = function read (reader, cb) {
  lp.decodeFromReader(reader, {fixed: true, bytes: 4}, cb)
}
