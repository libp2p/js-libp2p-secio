/* eslint-env mocha */
'use strict'

const pair = require('pull-pair/duplex')
const expect = require('chai').expect
const PeerId = require('peer-id')
const crypto = require('libp2p-crypto')
const parallel = require('run-parallel')
const series = require('run-series')
const ms = require('multistream-select')
const pull = require('pull-stream')
const Listener = ms.Listener
const Dialer = ms.Dialer

const SecureSession = require('../src').SecureSession

describe('libp2p-secio', () => {
  it('upgrades a connection', (done) => {
    const p = pair()

    const local = createSession(p[0])
    const remote = createSession(p[1])
    const localSecure = local.session.secure

    pull(
      pull.values(['hello world']),
      localSecure
    )

    const remoteSecure = remote.session.secure
    pull(
      remoteSecure,
      pull.collect((err, chunks) => {
        expect(err).to.not.exist
        expect(chunks).to.be.eql([new Buffer('hello world')])
        done()
      })
    )
  })

  it('works over multistream', (done) => {
    const p = pair()

    const listener = new Listener()
    const dialer = new Dialer()
    let local
    let remote
    series([
      (cb) => parallel([
        (cb) => listener.handle(p[0], cb),
        (cb) => dialer.handle(p[1], cb)
      ], cb),
      (cb) => {
        listener.addHandler('/banana/1.0.0', (conn) => {
          local = createSession(conn).session.secure
          pull(
            local,
            pull.collect((err, chunks) => {
              expect(err).to.not.exist
              expect(chunks).to.be.eql([new Buffer('hello world')])
              done()
            })
          )
        })
        cb()
      },
      (cb) => dialer.select('/banana/1.0.0', (err, conn) => {
        remote = createSession(conn).session.secure
        pull(
          pull.values(['hello world']),
          remote
        )
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
