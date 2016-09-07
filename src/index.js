'use strict'

const pull = require('pull-stream')
const Connection = require('interface-connection').Connection

const handshake = require('./handshake')
const State = require('./state')

module.exports = {
  tag: '/secio/1.0.0',
  encrypt (local, key, insecure) {
    if (!local) {
      throw new Error('no local id provided')
    }

    if (!key) {
      throw new Error('no local private key provided')
    }

    if (!insecure) {
      throw new Error('no insecure stream provided')
    }

    const state = new State(local, key)

    pull(
      insecure,
      handshake(state),
      insecure
    )

    return new Connection(state.secure, insecure)
  }
}
