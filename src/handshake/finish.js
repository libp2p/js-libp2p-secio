'use strict'

const duplexify = require('duplexify')
const debug = require('debug')
const log = debug('libp2p:secio')
log.error = debug('libp2p:secio:error')
const read = require('async-buffered-reader')

const etm = require('../etm')

// step 3. Finish
// -- send expected message to verify encryption works (send local nonce)
module.exports = function finish (session, cb) {
  log('3. finish - start')

  const w = etm.writer(session.insecure, session.local.cipher, session.local.mac)
  const r = etm.reader(session.insecure, session.remote.cipher, session.remote.mac)
  session.secure = duplexify(w, r)
  session.secure.write(session.proposal.randIn)

  // read our nonce back
  read(session.secure, 16, (nonceOut2) => {
    const nonceOut = session.proposal.nonceOut
    if (!nonceOut.equals(nonceOut2)) {
      const err = new Error(`Failed to read our encrypted nonce: ${nonceOut.toString('hex')} != ${nonceOut2.toString('hex')}`)
      log.error(err)
      return cb(err)
    }

    log('3. finish - finish', nonceOut.toString('hex'), nonceOut2.toString('hex'))

    // Awesome that's all folks.
    cb()
  })
}
