'use strict'

const debug = require('debug')
const log = debug('libp2p:secio')
log.error = debug('libp2p:secio:error')

const DuplexPair = require('it-pair/duplex')
const pipe = require('it-pipe')
const lp = require('it-length-prefixed')
const Wrap = require('it-pb-rpc')
const { int32BEEncode, int32BEDecode } = lp
const ensureBuffer = require('it-buffer')

const etm = require('../etm')
const crypto = require('./crypto')

// step 3. Finish
// -- send expected message to verify encryption works (send local nonce)
module.exports = async function finish (state, wrapped) {
  log('3. finish - start')

  const proto = state.protocols

  const [secure, user] = DuplexPair()
  const network = wrapped.unwrap()

  pipe(
    secure, // this is FROM the user
    ensureBuffer,
    etm.createBoxStream(proto.local.cipher, proto.local.mac),
    lp.encode({ lengthEncoder: int32BEEncode }),
    network, // and gets piped INTO and FROM the network
    lp.decode({ lengthDecoder: int32BEDecode }),
    ensureBuffer,
    etm.createUnboxStream(proto.remote.cipher, proto.remote.mac),
    secure // and gets piped TO the user
  )

  // Exchange nonces over the encrypted stream for final verification
  const shake = Wrap(user)
  shake.write(state.proposal.in.rand)
  const nonceBack = await shake.read(state.proposal.in.rand.length)
  crypto.verifyNonce(state, nonceBack.slice())

  log('3. finish - finish')

  // Awesome that's all folks.
  state.secure = shake.unwrap()
}
