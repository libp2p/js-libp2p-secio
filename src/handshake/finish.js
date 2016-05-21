'use strict'

const debug = require('debug')
const log = debug('libp2p:secio:handshake')
log.error = debug('libp2p:secio:handshake:error')

function finish () {
  log('3. finish - start')

  // TODO: wrap insecure stream with the new secure stream

  // TODO: send nonce to remote via the secure channel

  // TODO: read our nonce back

  // TODO: compare read and local nonce

  log('3. finish - finish')
}
