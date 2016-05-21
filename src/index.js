'use strict'

const handshake = require('./handshake')

module.exports = class SecureSession {
  constructor (local, key, insecure) {
    this.localKey = key
    this.localPeer = local
    this.sharedSecret = null
    this.local = {}
    this.remote = {}
    this.insecure = insecure

    if (!this.localPeer) {
      throw new Error('no local id provided')
    }

    if (!this.localKey) {
      throw new Error('no local private key provided')
    }

    // Enable when implemented in js-peer-id
    // if (!this.localPeer.matchesPrivateKey(this.localKey)) {
    //   throw new Error('peer.ID does not match privateKey')
    // }

    if (!insecure) {
      throw new Error('no insecure stream provided')
    }
  }

  handshake () {
    // TODO: figure out how to best handle the handshake timeout
    // TODO: better locking
    // TODO: async and callbacks? :(
    if (this._handshakeLock) return
    this._handshakeLock = true

    const unlock = () => {
      this._handshakeLock = false
    }

    if (this._handshakeDone) return unlock()

    handshake(this)
    this._handshakeDone = true
    unlock()
  }
}
