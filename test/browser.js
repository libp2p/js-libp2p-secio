/* eslint-env mocha */
'use strict'

const expect = require('chai').expect
const multiaddr = require('multiaddr')
const pull = require('pull-stream')
const pullGoodbye = require('pull-goodbye')

const secio = require('../src')
const WS = require('libp2p-websockets')
const PeerId = require('peer-id')
const peerBrowserJSON = require('./peer-browser.json')

describe('secio browser <-> nodejs', () => {
  const ma = multiaddr('/ip4/127.0.0.1/tcp/9090/ws')
  let ws
  let conn
  let pid
  let encryptedConn

  before((done) => {
    PeerId.createFromJSON(peerBrowserJSON, (err, _pid) => {
      expect(err).to.not.exist

      pid = _pid
      ws = new WS()
      expect(ws).to.exist
      conn = ws.dial(ma, (err) => {
        expect(err).to.not.exist
        done()
      })
    })
  })

  it('encrypt', (done) => {
    secio.encrypt(pid, pid._privKey, conn, (err, c) => {
      expect(err).to.not.exist
      encryptedConn = c
      done()
    })
  })

  it('echo', (done) => {
    const message = 'Hello World!'

    const s = pullGoodbye({
      source: pull.values([message]),
      sink: pull.collect((err, results) => {
        expect(err).to.not.exist
        expect(results).to.be.eql([message])
        done()
      })
    })

    pull(s, encryptedConn, s)
  })
})
