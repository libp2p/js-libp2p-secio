/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */
'use strict'

const pair = require('pull-pair/duplex')
const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)
const PeerId = require('peer-id')
const crypto = require('libp2p-crypto')
const parallel = require('async/parallel')
const series = require('async/series')
const Buffer = require('safe-buffer').Buffer
const ms = require('multistream-select')
const pull = require('pull-stream')
const Listener = ms.Listener
const Dialer = ms.Dialer

const secio = require('../src')

describe('libp2p-secio', () => {
  it('exports a tag', () => {
    expect(secio.tag).to.equal('/secio/1.0.0')
  })

  it('upgrades a connection', (done) => {
    const p = pair()
    createSession(p[0], (err, local) => {
      expect(err).to.not.exist()

      createSession(p[1], (err, remote) => {
        expect(err).to.not.exist()

        pull(
          pull.values([Buffer.from('hello world')]),
          local
        )

        pull(
          remote,
          pull.collect((err, chunks) => {
            expect(err).to.not.exist()
            expect(chunks).to.eql([Buffer.from('hello world')])
            done()
          })
        )
      })
    })
  })

  it('works over multistream', (done) => {
    const p = pair()

    const listener = new Listener()
    const dialer = new Dialer()

    series([
      (cb) => parallel([
        (cb) => listener.handle(p[0], cb),
        (cb) => dialer.handle(p[1], cb)
      ], cb),
      (cb) => {
        listener.addHandler('/banana/1.0.0', (protocol, conn) => {
          createSession(conn, (err, local) => {
            expect(err).to.not.exist()
            pull(
              local,
              pull.collect((err, chunks) => {
                expect(err).to.not.exist()
                expect(chunks).to.be.eql([new Buffer('hello world')])
                done()
              })
            )
          })
        })
        cb()
      },
      (cb) => dialer.select('/banana/1.0.0', (err, conn) => {
        expect(err).to.not.exist()

        createSession(conn, (err, remote) => {
          expect(err).to.not.exist()
          pull(
            pull.values([new Buffer('hello world')]),
            remote
          )
          cb()
        })
      })
    ], (err) => expect(err).to.not.exist())
  })
})

function createSession (insecure, callback) {
  crypto.keys.generateKeyPair('RSA', 2048, (err, key) => {
    expect(err).to.not.exist()

    key.public.hash((err, digest) => {
      expect(err).to.not.exist()

      callback(null, secio.encrypt(new PeerId(digest, key), key, insecure))
    })
  })
}
