/* eslint-env mocha */
'use strict'

const expect = require('chai').expect
const through = require('through2')
const bl = require('bl')
const PeerId = require('peer-id')
const crypto = require('libp2p-crypto')
const streamPair = require('stream-pair')

const SecureSession = require('../src').SecureSession

describe('libp2p-secio', () => {
  describe('insecure length prefixed stream', () => {
    it('encodes', (done) => {
      const id = PeerId.create({bits: 64})
      const key = {}
      const insecure = through()
      const s = new SecureSession(id, key, insecure)

      // encoded on raw
      s.insecure.pipe(bl((err, res) => {
        expect(err).to.not.exist
        expect(res.toString()).to.be.eql('\u0005hello\u0005world')
        done()
      }))

      s.insecureLp.write('hello')
      s.insecureLp.write('world')
      insecure.end()
    })

    it('decodes', (done) => {
      const id = PeerId.create({bits: 64})
      const key = {}
      const insecure = through()
      const s = new SecureSession(id, key, insecure)

      // encoded on raw
      s.insecureLp.pipe(bl((err, res) => {
        expect(err).to.not.exist
        expect(res.toString()).to.be.eql('helloworld')
        done()
      }))

      s.insecure.write('\u0005hello')
      s.insecure.write('\u0005world')
      s.insecureLp.end()
    })

    it('all together now', (done) => {
      const pair = streamPair.create()

      createSession(pair, (err, local) => {
        if (err) throw err
        createSession(pair.other, (err, remote) => {
          if (err) throw err

          remote.session.insecureLp.pipe(bl((err, res) => {
            if (err) throw err
            expect(res.toString()).to.be.eql('hello world')
            done()
          }))

          local.session.insecureLp.write('hello ')
          local.session.insecureLp.write('world')
          pair.end()
        })
      })
    })
  })

  it('upgrades a connection', (done) => {
    const pair = streamPair.create()

    createSession(pair, (err, local) => {
      if (err) throw err
      createSession(pair.other, (err, remote) => {
        if (err) throw err

        local.session.secureStream((err, localSecure) => {
          if (err) throw err

          localSecure.write('hello world')
        })

        remote.session.secureStream((err, remoteSecure) => {
          if (err) throw err
          remoteSecure.once('data', (chunk) => {
            expect(chunk.toString()).to.be.eql('hello world')
            done()
          })
        })
      })
    })
  })
})

function createSession (insecure, cb) {
  crypto.generateKeyPair('RSA', 2048, (err, key) => {
    if (err) return cb(err)
    const id = PeerId.createFromPrivKey(key.bytes)
    cb(null, {
      id,
      key,
      insecure,
      session: new SecureSession(id, key, insecure)
    })
  })
}
