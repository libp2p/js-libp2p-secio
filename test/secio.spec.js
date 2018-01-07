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

describe('secio', () => {
  let peerA
  let peerB
  let peerC

  before((done) => {
    parallel([
      (cb) => PeerId.createFromJSON(require('./fixtures/peer-a'), cb),
      (cb) => PeerId.createFromJSON(require('./fixtures/peer-b'), cb),
      (cb) => PeerId.createFromJSON(require('./fixtures/peer-c'), cb)
    ], (err, peers) => {
      expect(err).to.not.exist()
      peerA = peers[0]
      peerB = peers[1]
      peerC = peers[2]
      done()
    })
  })

  it('exports a secio multicodec', () => {
    expect(secio.tag).to.equal('/secio/1.0.0')
  })

  it('upgrades a connection', (done) => {
    const p = pair()

    const aToB = secio.encrypt(peerB, peerA.privKey, p[0], (err) => expect(err).to.not.exist())
    const bToA = secio.encrypt(peerA, peerB.privKey, p[1], (err) => expect(err).to.not.exist())

    pull(
      pull.values([Buffer.from('hello world')]),
      aToB
    )

    pull(
      bToA,
      pull.collect((err, chunks) => {
        expect(err).to.not.exist()
        expect(chunks).to.eql([Buffer.from('hello world')])
        done()
      })
    )
  })

  it('works over multistream-select', (done) => {
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
          const bToA = secio.encrypt(peerA, peerB.privKey, conn, (err) => expect(err).to.not.exist())

          pull(
            bToA,
            pull.collect((err, chunks) => {
              expect(err).to.not.exist()
              expect(chunks).to.eql([Buffer.from('hello world')])
              done()
            })
          )
        })

        cb()
      },
      (cb) => dialer.select('/banana/1.0.0', (err, conn) => {
        expect(err).to.not.exist()

        const aToB = secio.encrypt(peerB, peerA.privKey, conn, (err) => expect(err).to.not.exist())

        pull(
          pull.values([Buffer.from('hello world')]),
          aToB
        )
        cb()
      })
    ])
  })

  it.skip('fails if we dialed to the wrong peer', (done) => {
  })
})
