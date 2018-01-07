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

const peerNodeJSON = require('./fixtures/peer-node.json')
const peerBrowserJSON = require('./fixtures/peer-browser.json')

const secio = require('../src')

describe('secio between browser <-> nodejs through websockets', () => {
  const ma = multiaddr('/ip4/127.0.0.1/tcp/9090/ws')
  let conn
  let encryptedConn

  before((done) => {
    parallel([
      (cb) => PeerId.createFromJSON(peerNodeJSON, cb),
      (cb) => PeerId.createFromJSON(peerBrowserJSON, cb),

      (cb) => {
        const ws = new WS()
        conn = ws.dial(ma, cb)
      }
    ], (err, res) => {
      expect(err).to.not.exist()

      const peerIdNode = res[0]
      const peerIdBrowser = res[1]

      encryptedConn = secio.encrypt(peerIdBrowser, conn, peerIdNode, (err) => {
        expect(err).to.not.exist()
      })
      done()
    })
  })

  it('echo', (done) => {
    const message = 'Hello World!'

    const s = pullGoodbye({
      source: pull.values([message]),
      sink: pull.collect((err, results) => {
        expect(err).to.not.exist()
        expect(results).to.eql([message])
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
