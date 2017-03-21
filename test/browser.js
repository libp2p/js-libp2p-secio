/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)
const multiaddr = require('multiaddr')
const pull = require('pull-stream')
const pullGoodbye = require('pull-goodbye')
const WS = require('libp2p-websockets')
const PeerId = require('peer-id')
const parallel = require('async/parallel')

const peerBrowserJSON = require('./peer-browser.json')
const secio = require('../src')

describe('secio browser <-> nodejs', () => {
  const ma = multiaddr('/ip4/127.0.0.1/tcp/9090/ws')
  let conn
  let encryptedConn

  before((done) => {
    parallel([
      (cb) => PeerId.createFromJSON(peerBrowserJSON, cb),
      (cb) => {
        const ws = new WS()
        conn = ws.dial(ma, cb)
      }
    ], (err, res) => {
      if (err) {
        return done(err)
      }

      encryptedConn = secio.encrypt(res[0], res[0]._privKey, conn)
      done()
    })
  })

  it('echo', (done) => {
    const message = 'Hello World!'

    const s = pullGoodbye({
      source: pull.values([message]),
      sink: pull.collect((err, results) => {
        expect(err).to.not.exist()
        expect(results).to.be.eql([message])
        done()
      })
    }, 'GoodBye')

    pull(
      s,
      encryptedConn,
      // Need to convert to a string as goodbye only understands strings

      pull.map((msg) => msg.toString()),
      s
    )
  })
})
