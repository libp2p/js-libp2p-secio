'use strict'

const multiaddr = require('multiaddr')
const pull = require('pull-stream')
const WS = require('libp2p-websockets')
const PeerId = require('peer-id')

const secio = require('./src')

const peerNodeJSON = require('./test/peer-node.json')
const ma = multiaddr('/ip4/127.0.0.1/tcp/9090/ws')
let listener

module.exports = {
  hooks: {
    browser: {
      pre: (done) => {
        PeerId.createFromJSON(peerNodeJSON, (err, id) => {
          if (err) { throw err }

          const ws = new WS()

          listener = ws.createListener((conn) => {
            const encrypted = secio.encrypt(id, id._privKey, conn, (err) => {
              if (err) { throw err }
            })

            pull(encrypted, encrypted)
          })

          listener.listen(ma, done)
        })
      },
      post: (done) => {
        listener.close(done)
      }
    }
  }
}
