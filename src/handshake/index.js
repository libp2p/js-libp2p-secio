'use strict'

const series = require('run-series')

const propose = require('./propose')
const exchange = require('./exchange')
const finish = require('./finish')

// Performs initial communication over insecure channel to share
// keys, IDs, and initiate communication, assigning all necessary params.
module.exports = function handshake (state) {
  series([
    (cb) => propose(state, cb),
    (cb) => exchange(state, cb),
    (cb) => finish(state, cb)
  ], (err) => {
    state.cleanSecrets()

    if (err) {
      state.shake.abort(err)
    }
  })

  return state.stream
}
