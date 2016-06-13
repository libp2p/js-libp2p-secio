'use strict'

const pull = require('pull-stream')
const Connection = require('interface-connection').Connection

const handshake = require('./handshake')
const State = require('./state')

exports.SecureSession = class SecureSession {
  constructor (local, key, insecure) {
    if (!local) {
      throw new Error('no local id provided')
    }

    if (!key) {
      throw new Error('no local private key provided')
    }

    if (!insecure) {
      throw new Error('no insecure stream provided')
    }

    this.state = new State(local, key)
    this.insecure = insecure

    pull(
      this.insecure,
      handshake(this.state),
      this.insecure
    )
  }

  get secure () {
    return new Connection(this.state.secure, this.insecure)
  }
}
