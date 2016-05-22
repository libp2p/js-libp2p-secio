'use strict'

const debug = require('debug')
const series = require('run-series')

const log = debug('libp2p:secio')
log.error = debug('libp2p:secio:error')

const propose = require('./propose')
const exchange = require('./exchange')
const finish = require('./finish')

// Performs initial communication over insecure channel to share
// keys, IDs, and initiate communication, assigning all necessary params.
module.exports = function handshake (session, cb) {
  series([
    (cb) => propose(session, cb),
    (cb) => exchange(session, cb),
    (cb) => finish(session, cb)
  ], cb)
}
