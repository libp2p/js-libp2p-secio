'use strict'

const crypto = require('libp2p-crypto')
const debug = require('debug')
const fs = require('fs')
const path = require('path')
const protobuf = require('protocol-buffers')

const log = debug('libp2p:secio:handshake')
log.error = debug('libp2p:secio:handshake:error')

const pbm = protobuf(fs.readFileSync(path.join(__dirname, '../secio.proto')))

const support = require('../support')

// step 2. Exchange
// -- exchange (signed) ephemeral keys. verify signatures.
module.exports = function exchange (session, cb) {
  log('2. exchange - start')

  let eResult
  try {
    eResult = crypto.generateEphemeralKeyPair(session.local.curveT)
  } catch (err) {
    return cb(err)
  }

  session.local.ephemeralPubKey = eResult.key
  const genSharedKey = eResult.genSharedKey
  const exchangeOut = makeExchange(session)

  session.insecureLp.write(exchangeOut)
  session.insecureLp.once('data', (chunk) => {
    const exchangeIn = pbm.Exchange.decode(chunk)

    try {
      verify(session, exchangeIn)
      keys(session, exchangeIn, genSharedKey)
      macAndCipher(session)
    } catch (err) {
      return cb(err)
    }

    log('2. exchange - finish')
    cb()
  })
}

function makeExchange (session) {
  // Gather corpus to sign.
  const selectionOut = Buffer.concat([
    session.proposal.out,
    session.proposal.in,
    session.local.ephemeralPubKey
  ])
  return pbm.Exchange({
    epubkey: session.local.ephemeralPubKey,
    signature: session.localKey.sign(selectionOut)
  })
}

function verify (session, exchangeIn) {
  log('2.1. verify')

  session.remote.ephemeralPubKey = exchangeIn.epubkey

  const selectionIn = Buffer.concat([
    session.proposal.in,
    session.proposal.out,
    session.remote.ephemeralPubKey
  ])

  const sigOk = session.remote.permanentPubKey.verify(selectionIn, exchangeIn.signature)

  if (!sigOk) {
    throw new Error('Bad signature')
  }

  log('2.1. verify - signature verified')
}

function keys (session, exchangeIn, genSharedKey) {
  log('2.2. keys')

  session.sharedSecret = genSharedKey(exchangeIn.epubkey)

  const keys = crypto.keyStretcher(session.local.cipherT, session.local.hashT, session.sharedSecret)

  // use random nonces to decide order.
  if (session.proposal.order > 0) {
    session.local.keys = keys.k1
    session.remote.keys = keys.k2
  } else if (session.proposal.order < 0) {
    // swap
    session.local.keys = keys.k2
    session.remote.keys = keys.k1
  } else {
		// we should've bailed before this. but if not, bail here.
    throw new Error('you are trying to talk to yourself')
  }

  log('2.2. keys - shared: %s\n\tlocal: %s\n\tremote: %s', session.sharedSecret, session.local.keys, session.remote.keys)
}

function macAndCipher (session) {
  log('2.3. mac + cipher')

  support.makeMacAndCipher(session.local)
  support.makeMacAndCipher(session.remote)
}
