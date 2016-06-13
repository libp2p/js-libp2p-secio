'use strict'

const debug = require('debug')

const support = require('../support')
const crypto = require('./crypto')

const log = debug('libp2p:secio')
log.error = debug('libp2p:secio:error')

// step 2. Exchange
// -- exchange (signed) ephemeral keys. verify signatures.
module.exports = function exchange (state, cb) {
  log('2. exchange - start')

  log('2. exchange - writing exchange')
  support.write(state, crypto.createExchange(state))
  support.read(state.shake, (err, msg) => {
    if (err) {
      return cb(err)
    }

    log('2. exchange - reading exchange')

    try {
      crypto.verify(state, msg)
      crypto.generateKeys(state)
    } catch (err) {
      return cb(err)
    }

    log('2. exchange - finish')
    cb()
  })
}
