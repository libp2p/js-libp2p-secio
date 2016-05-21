'use strict'

const crypto = require('libp2p-crypto')
const debug = require('debug')
const protobuf = require('protocol-buffers')
const path = require('path')
const fs = require('fs')

const log = debug('libp2p:secio:handshake')
log.error = debug('libp2p:secio:handshake:error')

const pbm = protobuf(fs.readFileSync(path.join(__dirname, '../secio.proto')))

const propose = require('./propose')
const exchange = require('./exchange')
const finish = require('./finish')

// HandshakeTimeout governs how long the handshake will be allowed to take place for.
// Making this number large means there could be many bogus connections waiting to
// timeout in flight. Typical handshakes take ~3RTTs, so it should be completed within
// seconds across a typical planet in the solar system.
const handshakeTimeout = 30 * 1000


// Performs initial communication over insecure channel to share
// keys, IDs, and initiate communication, assigning all necessary params.
function run (session) {
  // step 1. Propose
  // -- propose cipher suite + send pubkeys + nonce
  propose(session)

  // step 2. Exchange
  // -- exchange (signed) ephemeral keys. verify signatures.
  exchange(session)

  // step 3. Finish
  // -- send expected message to verify encryption works (send local nonce)
  finish(session)
}
