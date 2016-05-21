'use strict'

const crypto = require('libp2p-crypto')
const debug = require('debug')
const log = debug('libp2p:secio:handshake')
log.error = debug('libp2p:secio:handshake:error')

const support = require('../support')

module.exports = function exchange (session) {
  log('2. exchange - start')

  const eResult = crypto.generateEphemeralKeyPair(session.local.curveT)
  session.local.ephemeralPubKey = eResult.key
  const genSharedKey = eResult.genSharedKey

  // Gather corpus to sign.
  const selectionOut = Buffer.concat([
    proposeOutBytes,
    proposeInBytes,
    session.local.ephemeralPubKey
  ])

  const exchangeOut = pbm.Exchange({
    epubkey: session.local.ephemeralPubKey,
    signature: session.localKey.sign(selectionOut)
  })

  // TODO: write exchangeOut
  // TODO: read exchangeIn
  const exchangeIn // = ...read

  log('2.1. verify')

  session.remote.ephemeralPubKey = exchangeIn.epubkey

  const selectionIn = Buffer.concat([
    proposeInBytes,
    proposeOutBytes,
    session.remote.ephemeralPubKey
  ])

  const sigOk = session.remote.permanentPubKey.verify(selectionIn, exchangeIn.signature)

  if (!sigOk) {
    throw new Error('Bad signature')
  }

  log('2.1. verify - signature verified')

  log('2.2. keys')

  session.sharedSecret = genSharedKey(exchangeIn.epubkey)

  const keys = crypto.keyStretcher(session.local.cipherT, session.local.hashT, session.sharedSecret)

  // use random nonces to decide order.
  if (order > 0) {
    session.local.keys = keys.k1
    session.remote.keys = keys.k2
  } else if (order < 0) {
    // swap
    session.local.keys = keys.k2
    session.remote.keys = keys.k1
  } else {
		// we should've bailed before this. but if not, bail here.
    throw new Error('you are trying to talk to yourself')
  }

  log('2.2. keys - shared: %s\n\tlocal: %s\n\tremote: %s', session.sharedSecret, session.local.keys, session.remote.keys)

  log('2.3. mac + cipher')

  support.makeMacAndCipher(session.local)
  support.makeMacAndCipher(session.remote)

  log('2. exchange - finish')
}
