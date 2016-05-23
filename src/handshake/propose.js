'use strict'

const forge = require('node-forge')
const debug = require('debug')
const protobuf = require('protocol-buffers')
const path = require('path')
const fs = require('fs')
const PeerId = require('peer-id')
const mh = require('multihashing')
const crypto = require('libp2p-crypto')

const log = debug('libp2p:secio')
log.error = debug('libp2p:secio:error')

// nonceSize is the size of our nonces (in bytes)
const nonceSize = 16

const pbm = protobuf(fs.readFileSync(path.join(__dirname, '../secio.proto')))
const support = require('../support')

// step 1. Propose
// -- propose cipher suite + send pubkeys + nonce
module.exports = function propose (session, cb) {
  log('1. propose - start')

  const nonceOut = new Buffer(forge.random.getBytesSync(nonceSize), 'binary')
  const proposeOut = makeProposal(session, nonceOut)

  session.proposal.out = proposeOut
  session.proposal.nonceOut = nonceOut

  log('1. propse - writing proposal')
  session.insecureLp.write(proposeOut)
  session.insecureLp.once('data', (chunk) => {
    log('1. propse - reading proposal')

    let proposeIn

    try {
      proposeIn = readProposal(chunk)
      session.proposal.in = chunk
      session.proposal.randIn = proposeIn.rand
      identify(session, proposeIn)
    } catch (err) {
      return cb(err)
    }

    try {
      selection(session, nonceOut, proposeIn)
    } catch (err) {
      return cb(err)
    }

    log('1. propose - finish')

    cb()
  })
}

// Generate and send Hello packet.
// Hello = (rand, PublicKey, Supported)
function makeProposal (session, nonceOut) {
  session.local.permanentPubKey = session.localKey.public
  const myPubKeyBytes = session.local.permanentPubKey.bytes

  return pbm.Propose.encode({
    rand: nonceOut,
    pubkey: myPubKeyBytes,
    exchanges: support.exchanges.join(','),
    ciphers: support.ciphers.join(','),
    hashes: support.hashes.join(',')
  })
}

function readProposal (bytes) {
  return pbm.Propose.decode(bytes)
}

function identify (session, proposeIn) {
  log('1.1 identify')

  session.remote.permanentPubKey = crypto.unmarshalPublicKey(proposeIn.pubkey)
  session.remotePeer = PeerId.createFromPubKey(proposeIn.pubkey.toString('base64'))

  log('1.1 identify - %s - identified remote peer as %s', session.localPeer.toB58String(), session.remotePeer.toB58String())
}

function selection (session, nonceOut, proposeIn) {
  log('1.2 selection')

  const local = {
    pubKeyBytes: session.local.permanentPubKey.bytes,
    exchanges: support.exchanges,
    hashes: support.hashes,
    ciphers: support.ciphers,
    nonce: nonceOut
  }

  const remote = {
    pubKeyBytes: proposeIn.pubkey,
    exchanges: proposeIn.exchanges.split(','),
    hashes: proposeIn.hashes.split(','),
    ciphers: proposeIn.ciphers.split(','),
    nonce: proposeIn.rand
  }

  let selected = selectBest(local, remote)
  session.proposal.order = selected.order

  session.local.curveT = selected.curveT
  session.local.cipherT = selected.cipherT
  session.local.hashT = selected.hashT

	// we use the same params for both directions (must choose same curve)
	// WARNING: if they dont SelectBest the same way, this won't work...
  session.remote.curveT = session.local.curveT
  session.remote.cipherT = session.local.cipherT
  session.remote.hashT = session.local.hashT
}

function selectBest (local, remote) {
  const oh1 = digest(Buffer.concat([
    remote.pubKeyBytes,
    local.nonce
  ]))
  const oh2 = digest(Buffer.concat([
    local.pubKeyBytes,
    remote.nonce
  ]))
  const order = Buffer.compare(oh1, oh2)

  if (order === 0) {
    throw new Error('you are trying to talk to yourself')
  }

  return {
    curveT: support.theBest(order, local.exchanges, remote.exchanges),
    cipherT: support.theBest(order, local.ciphers, remote.ciphers),
    hashT: support.theBest(order, local.hashes, remote.hashes),
    order
  }
}

function digest (buf) {
  return mh.digest(buf, 'sha2-256', buf.length)
}
