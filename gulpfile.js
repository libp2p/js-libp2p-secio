'use strict'

const gulp = require('gulp')
const multiaddr = require('multiaddr')
const pull = require('pull-stream')
const WS = require('libp2p-websockets')
const PeerId = require('peer-id')

const peerNodeJSON = require('./test/peer-node.json')
const secio = require('./src')

let listener
const ma = multiaddr('/ip4/127.0.0.1/tcp/9090/ws')

gulp.task('test:browser:before', (done) => {
  PeerId.createFromJSON(peerNodeJSON, (err, id) => {
    if (err) {
      throw err
    }

    const ws = new WS()
    listener = ws.createListener((conn) => {
      const encrypted = secio.encrypt(id, id._privKey, conn, (err) => {
        if (err) {
          throw err
        }
      })

      pull(
        encrypted,
        encrypted
      )
    })

    listener.listen(ma, done)
  })
})

gulp.task('test:browser:after', (done) => {
  listener.close(done)
})

require('aegir/gulp')(gulp)
