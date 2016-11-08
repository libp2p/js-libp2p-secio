'use strict'

const gulp = require('gulp')
const multiaddr = require('multiaddr')
const secio = require('./src')
const pull = require('pull-stream')

const WS = require('libp2p-websockets')

let listener
const PeerId = require('peer-id')
const peerNodeJSON = require('./test/peer-node.json')

gulp.task('test:browser:before', (done) => {
  // echo on an encrypted channel
  PeerId.createFromJSON(peerNodeJSON, (err, pid) => {
    if (err) {
      return done(err)
    }

    const ws = new WS()
    const ma = multiaddr('/ip4/127.0.0.1/tcp/9090/ws')
    listener = ws.createListener((conn) => {
      secio.encrypt(pid, {
        public: pid._pubKey,
        private: pid._privKey
      }, conn, (err, conn) => {
        if (err) {
          return done(err)
        }
        pull(conn, conn)
      })
    })
    listener.listen(ma, done)
  })
})

gulp.task('test:browser:after', (done) => {
  listener.close(done)
})

require('aegir/gulp')(gulp)
