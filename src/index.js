'use strict'

const duplexify = require('duplexify')
const lpstream = require('length-prefixed-stream')
const PassThrough = require('readable-stream').PassThrough

const handshake = require('./handshake')

exports.SecureSession = class SecureSession {
  constructor (local, key, insecure) {
    this.localKey = key
    this.localPeer = local
    this.sharedSecret = null
    this.local = {}
    this.remote = {}
    this.proposal = {}
    this.insecure = insecure
    this.secure = null
    const e = lpstream.encode()
    const d = lpstream.decode()
    this.insecureLp = duplexify(e, d)

    e.pipe(this.insecure)
    this.insecure.pipe(d)

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

  secureStream () {
    let handshaked = false
    const reader = new PassThrough()
    const writer = new PassThrough()
    const dp = duplexify(writer, reader)
    const originalRead = reader.read.bind(reader)
    const originalWrite = writer.write.bind(writer)

    const doHandshake = () => {
      if (handshaked) return

      handshaked = true

      // Restore methods to avoid overhead
      reader.read = originalRead
      writer.write = originalWrite

      this.handshake((err) => {
        if (err) {
          dp.emit('error', err)
        }

        // Pipe things together
        writer.pipe(this.secure)
        this.secure.pipe(reader)

        dp.uncork()
        dp.resume()
      })
    }

    // patch to detect first read
    reader.read = (size) => {
      doHandshake()
      originalRead(size)
    }

    // patch to detect first write
    writer.write = (chunk, encoding, callback) => {
      doHandshake()
      originalWrite(chunk, encoding, callback)
    }

    dp.cork()
    dp.pause()

    return dp
  }

  handshake (cb) {
    // TODO: figure out how to best handle the handshake timeout
    if (this._handshakeLock) {
      return cb(new Error('handshake already in progress'))
    }

    this._handshakeLock = true

    const finish = (err) => {
      this._handshakeLock = false
      cb(err)
    }

    if (this._handshakeDone) {
      return finish()
    }

    handshake(this, (err) => {
      if (err) {
        return finish(err)
      }

      this._handshakeDone = true
      finish()
    })
  }
}
