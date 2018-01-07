'use strict'

const Benchmark = require('benchmark')
const pull = require('pull-stream')
const parallel = require('async/parallel')
const pair = require('pull-pair/duplex')
const PeerId = require('peer-id')

const secio = require('../src')

const suite = new Benchmark.Suite('secio')

suite.add('establish an encrypted channel', (deferred) => {
  const p = pair()

  parallel([
    (cb) => PeerId.createFromJSON(require('./peer-a'), cb),
    (cb) => PeerId.createFromJSON(require('./peer-b'), cb)
  ], (err, peers) => {
    if (err) { throw err }

    const peerA = peers[0]
    const peerB = peers[1]

    const aToB = secio.encrypt(peerB, peerA.privKey, p[0], (err) => { throw err })
    const bToA = secio.encrypt(peerA, peerB.privKey, p[1], (err) => { throw err })

    sendMessages(aToB, bToA)
  })

  function sendMessages (local, remote) {
    pull(
      pull.infinite(),
      pull.take(100),
      pull.map((val) => Buffer.from(val.toString())),
      local
    )

    pull(
      remote,
      pull.take(100),
      pull.collect((err, chunks) => {
        if (err) { throw err }
        if (chunks.length !== 100) { throw new Error('Did not receive enough chunks') }
        deferred.resolve()
      })
    )
  }
}, { defer: true })

suite.on('cycle', (event) => {
  console.log(String(event.target))
})

// run async
suite.run({ async: true })
