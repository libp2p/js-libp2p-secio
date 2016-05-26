/* eslint-env mocha */
'use strict'

const expect = require('chai').expect
const through = require('through2')
const bl = require('bl')
const PeerId = require('peer-id')
const crypto = require('libp2p-crypto')
const streamPair = require('stream-pair')
const parallel = require('run-parallel')
const series = require('run-series')
const ms = require('multistream-select')
const Listener = ms.Listener
const Dialer = ms.Dialer

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

      const local = createSession(pair)
      const remote = createSession(pair.other)
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

  it('upgrades a connection', (done) => {
    const pair = streamPair.create()

    const local = createSession(pair)
    const remote = createSession(pair.other)
    const localSecure = local.session.secureStream()
    localSecure.write('hello world')

    const remoteSecure = remote.session.secureStream()
    remoteSecure.once('data', (chunk) => {
      expect(chunk.toString()).to.be.eql('hello world')
      done()
    })
  })

  it('works over multistream', (done) => {
    const pair = streamPair.create()

    const listener = new Listener()
    const dialer = new Dialer()
    let local
    let remote
    series([
      (cb) => parallel([
        (cb) => listener.handle(pair, cb),
        (cb) => dialer.handle(pair.other, cb)
      ], cb),
      (cb) => {
        listener.addHandler('/banana/1.0.0', (conn) => {
          local = createSession(conn).session.secureStream()
          local.once('data', (res) => {
            expect(res.toString()).to.be.eql('hello world')
            done()
          })
        })
        cb()
      },
      (cb) => dialer.select('/banana/1.0.0', (err, conn) => {
        remote = createSession(conn).session.secureStream()
        remote.write('hello world')
        cb(err)
      })
    ], (err) => {
      if (err) throw err
    })
  })
})

function createSession (insecure) {
  const key = crypto.generateKeyPair('RSA', 2048)
  const id = PeerId.createFromPrivKey(key.bytes)
  return {
    id,
    key,
    insecure,
    session: new SecureSession(id, key, insecure)
  }
}
