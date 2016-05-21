'use strict'

const forge = require('node-forge')
const debug = require('debug')
const protobuf = require('protocol-buffers')
const path = require('path')
const fs = require('fs')
const PeerId = require('peer-id')
const mh = require('multihashing')

const log = debug('libp2p:secio:handshake')
log.error = debug('libp2p:secio:handshake:error')

// nonceSize is the size of our nonces (in bytes)
const nonceSize = 16

const pbm = protobuf(fs.readFileSync(path.join(__dirname, '../secio.proto')))
const support = require('./support')

module.exports = function propose (session) {
  log('1. propose - start')

  const nonceOut = forge.random.getBytesSync(nonceSize)
  const proposeOut = makeProposal(session, nonceOut)
  // TODO: write proposal to the insecure transport
  // TODO: read from the insecure transport
  const proposeIn = readProposal()

  log('1.1 identify')

  session.remote.permanentPubKey = crypto.unmarshalPublicKey(proposeIn.pubKey)
  session.remotePeer = PeerId.createFromPubKey(session.remote.permanentPubKey)

  log('1.1 identify - %s - identified remote peer as %s', session.localPeer.toB58String(), session.remotePeer.toB58String())

  log('1.2 selection')

  const local = {
    pubKeyBytes: session.local.permanentPubKey.bytes,
    exchanges: support.exchanges,
    hashes: support.hashes,
    ciphers: support.ciphers,
    nonce: nonceOut
  }
  const remote = {
    pubKeyBytes: proposeIn.pubKey,
    exchanges: proposeIn.exchanges.split(','),
    hashes: proposeIn.hashes.split(','),
    ciphers: proposeIn.ciphers.split(','),
    nonce: proposeIn.rand
  }
  const selected = selectBest(local, remote)
  session.local.curveT = selected.curveT
  session.local.cipherT = selected.cipherT
  session.local.hashT = selected.hashT

	// we use the same params for both directions (must choose same curve)
	// WARNING: if they dont SelectBest the same way, this won't work...
  session.remote.curveT = session.local.curveT
  session.remote.cipherT = session.local.cipherT
  session.remote.hashT = session.local.hashT

  log('1. propose - finish')
}

// Generate and send Hello packet.
// Hello = (rand, PublicKey, Supported)
function makeProposal (session, nonceOut) {
  session.local.permanentPubKey = session.localKey.getPublic()
  const myPubKeyBytes = session.local.permanentPubKey.bytes

  return pbm.Propose({
    rand: nonceOut,
    pubKey: myPubKeyBytes,
    exchanges: support.exchanges.join(','),
    ciphers: support.ciphers.join(','),
    hashes: support.hashes.join(',')
  })
}

function readProposal (bytes) {
  return pbm.Proposal.decode(bytes)
}

function selectBest (local, remote) {
  const digest = (buf) => mh.digest(buf, 'sha2-256', buf.length)

  const oh1 = digest(Buffer.concat(remote.pubKeyBytes, local.nonce))
  const oh2 = digest(Buffer.concat(local.pubKeyBytes, remote.nonce))
  const order = Buffer.compare(oh1, oh2)

  if (order === 0) {
    throw new Error('you are trying to talk to yourself')
  }

  return {
    curveT: support.theBest(order, local.exchanges, remote.exchanges),
    cipherT: support.theBest(order, local.ciphers, remote.ciphers),
    hashT: support.theBest(order, local.hashes, remote.hashes)
  }
}
