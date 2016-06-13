'use strict'

const debug = require('debug')

const support = require('../support')
const crypto = require('./crypto')

const log = debug('libp2p:secio')
log.error = debug('libp2p:secio:error')

// step 1. Propose
// -- propose cipher suite + send pubkeys + nonce
module.exports = function propose (state, cb) {
  log('1. propose - start')

  log('1. propose - writing proposal')
  support.write(state, crypto.createProposal(state))
  support.read(state.shake, (err, msg) => {
    if (err) {
      return cb(err)
    }

    log('1. propose - reading proposal', msg)

    try {
      crypto.identify(state, msg)
      crypto.selectProtocols(state)
    } catch (err) {
      return cb(err)
    }

    log('1. propose - finish')

    cb()
  })
}
