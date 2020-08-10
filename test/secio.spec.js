/* eslint-env mocha */
'use strict'

const { expect } = require('aegir/utils/chai')

const PeerId = require('peer-id')
const duplexPair = require('it-pair/duplex')
const Handshake = require('it-pb-rpc')
const Secio = require('../src')
const { createPeerIdsFromFixtures } = require('./fixtures/peer')
const {
  createExchange,
  createProposal,
  generateKeys,
  identify,
  selectProtocols,
  verify
} = require('../src/handshake/crypto')
const { createBoxStream, createUnboxStream } = require('../src/etm')
const State = require('../src/state')
const { Propose } = require('../src/handshake/secio.proto')
const uint8ArrayConcat = require('uint8arrays/concat')

describe('secio', () => {
  let remotePeer
  let localPeer

  before(async () => {
    [remotePeer, localPeer] = await createPeerIdsFromFixtures(2)
  })

  it('performs a spec compliant inbound exchange', async () => {
    const [inboundConnection, outboundConnection] = duplexPair()
    const [result] = await Promise.all([
      Secio.secureInbound(remotePeer, inboundConnection, null),
      (async () => {
        const wrap = Handshake(outboundConnection)
        const state = new State(localPeer, remotePeer)

        // Create our proposal
        const proposal = createProposal(state)

        // Send our proposal
        const proposalBuffer = new ArrayBuffer(4)
        const proposalLengthView = new DataView(proposalBuffer)
        proposalLengthView.setInt32(0, proposal.length)
        const proposalLength = new Uint8Array(proposalBuffer)
        wrap.write(uint8ArrayConcat([proposalLength, proposal]))

        // Read their proposal
        let theirProposalRaw = (await wrap.read()).slice()
        const theirProposalRawView = new DataView(theirProposalRaw.buffer, theirProposalRaw.byteOffset, theirProposalRaw.byteLength)
        let dataLength = theirProposalRawView.getInt32(0)
        theirProposalRaw = theirProposalRaw.slice(4, dataLength + 4)
        const theirProposal = Propose.decode(theirProposalRaw)
        expect(theirProposal.rand).to.have.length(16)
        expect(theirProposal.pubkey).to.eql(remotePeer.pubKey.bytes)
        expect(theirProposal.exchanges).to.equal('P-256,P-384,P-521')
        expect(theirProposal.ciphers).to.equal('AES-256,AES-128')
        expect(theirProposal.hashes).to.equal('SHA256,SHA512')

        // Select protocols
        identify(state, theirProposalRaw)
        await selectProtocols(state)
        expect(state.protocols.local).to.include({ curveT: 'P-256', cipherT: 'AES-256', hashT: 'SHA256' })
        expect(state.protocols.remote).to.include({ curveT: 'P-256', cipherT: 'AES-256', hashT: 'SHA256' })

        // Create our exchange
        const exchange = await createExchange(state)

        // Send our exchange
        const exchangeBuffer = new ArrayBuffer(4)
        const exchangeLengthView = new DataView(exchangeBuffer)
        exchangeLengthView.setInt32(0, exchange.length)
        const exchangeLength = new Uint8Array(exchangeBuffer)
        wrap.write(uint8ArrayConcat([exchangeLength, exchange]))

        // Read their exchange
        let theirExchangeRaw = (await wrap.read()).slice()
        const theirExchangeRawView = new DataView(theirExchangeRaw.buffer, theirExchangeRaw.byteOffset, theirExchangeRaw.byteLength)
        dataLength = theirExchangeRawView.getInt32(0)
        theirExchangeRaw = theirExchangeRaw.slice(4, dataLength + 4)
        await verify(state, theirExchangeRaw)

        // Generate the crypto keys
        await generateKeys(state)

        // Create the crypto stream
        const box = createBoxStream(state.protocols.local.cipher, state.protocols.local.mac)
        const unbox = createUnboxStream(state.protocols.remote.cipher, state.protocols.remote.mac)

        // Send back their nonce over the crypto stream
        const { value: nonce } = await box([state.proposal.in.rand]).next()
        expect(nonce.slice()).to.not.eql(state.proposal.in.rand) // The nonce should be encrypted

        const nonceBuffer = new ArrayBuffer(4)
        const nonceView = new DataView(nonceBuffer)
        nonceView.setInt32(0, nonce.length)
        const nonceLength = new Uint8Array(nonceBuffer)
        wrap.write(uint8ArrayConcat([nonceLength, nonce.slice()]))

        // Read our nonce from the crypto stream
        let ourNonceRaw = (await wrap.read())
        const ourNonceRawBuffer = ourNonceRaw.slice()
        const ourNonceRawView = new DataView(ourNonceRawBuffer.buffer, ourNonceRawBuffer.byteOffset, ourNonceRawBuffer.byteLength)
        dataLength = ourNonceRawView.getInt32(0)
        ourNonceRaw = ourNonceRaw.shallowSlice(4, dataLength + 4) // Unbox expects a BufferList, so shallow slice here
        expect(ourNonceRaw.slice()).to.not.eql(state.proposal.out.rand) // The nonce should be encrypted
        const { value: ourNonce } = await unbox([ourNonceRaw]).next()

        // Verify our nonce is correct
        expect(ourNonce.slice()).to.eql(state.proposal.out.rand)
      })()
    ])

    expect(result.remotePeer.pubKey).to.exist()
    expect(result.remotePeer.pubKey.bytes).to.eql(localPeer.pubKey.bytes)
  })

  it('performs a spec compliant outbound exchange', async () => {
    const [inboundConnection, outboundConnection] = duplexPair()
    const cidOnlyPeerId = PeerId.createFromCID(remotePeer.toB58String())
    const [result] = await Promise.all([
      Secio.secureOutbound(localPeer, outboundConnection, cidOnlyPeerId),
      (async () => {
        const wrap = Handshake(inboundConnection)
        const state = new State(remotePeer, localPeer)

        // Create our proposal
        const proposal = createProposal(state)

        // Send our proposal
        const proposalBuffer = new ArrayBuffer(4)
        const proposalLengthView = new DataView(proposalBuffer)
        proposalLengthView.setInt32(0, proposal.length)
        const proposalLength = new Uint8Array(proposalBuffer)
        wrap.write(uint8ArrayConcat([proposalLength, proposal]))

        // Read their proposal
        let theirProposalRaw = (await wrap.read()).slice()
        const theirProposalRawView = new DataView(theirProposalRaw.buffer, theirProposalRaw.byteOffset, theirProposalRaw.byteLength)
        let dataLength = theirProposalRawView.getInt32(0)
        theirProposalRaw = theirProposalRaw.slice(4, dataLength + 4)
        const theirProposal = Propose.decode(theirProposalRaw)
        expect(theirProposal.rand).to.have.length(16)
        expect(theirProposal.pubkey).to.eql(localPeer.pubKey.bytes)
        expect(theirProposal.exchanges).to.equal('P-256,P-384,P-521')
        expect(theirProposal.ciphers).to.equal('AES-256,AES-128')
        expect(theirProposal.hashes).to.equal('SHA256,SHA512')

        // Select protocols
        identify(state, theirProposalRaw)
        await selectProtocols(state)
        expect(state.protocols.local).to.include({ curveT: 'P-256', cipherT: 'AES-256', hashT: 'SHA256' })
        expect(state.protocols.remote).to.include({ curveT: 'P-256', cipherT: 'AES-256', hashT: 'SHA256' })

        // Create our exchange
        const exchange = await createExchange(state)

        // Send our exchange
        const exchangeBuffer = new ArrayBuffer(4)
        const exchangeLengthView = new DataView(exchangeBuffer)
        exchangeLengthView.setInt32(0, exchange.length)
        const exchangeLength = new Uint8Array(exchangeBuffer)
        wrap.write(uint8ArrayConcat([exchangeLength, exchange]))

        // Read their exchange
        let theirExchangeRaw = (await wrap.read()).slice()
        const theirExchangeRawView = new DataView(theirExchangeRaw.buffer, theirExchangeRaw.byteOffset, theirExchangeRaw.byteLength)
        dataLength = theirExchangeRawView.getInt32(0)
        theirExchangeRaw = theirExchangeRaw.slice(4, dataLength + 4)
        await verify(state, theirExchangeRaw)

        // Generate the crypto keys
        await generateKeys(state)

        // Create the crypto stream
        const box = createBoxStream(state.protocols.local.cipher, state.protocols.local.mac)
        const unbox = createUnboxStream(state.protocols.remote.cipher, state.protocols.remote.mac)

        // Send back their nonce over the crypto stream
        const { value: nonce } = await box([state.proposal.in.rand]).next()
        expect(nonce.slice()).to.not.eql(state.proposal.in.rand) // The nonce should be encrypted

        const nonceBuffer = new ArrayBuffer(4)
        const nonceView = new DataView(nonceBuffer)
        nonceView.setInt32(0, nonce.length)
        const nonceLength = new Uint8Array(nonceBuffer)
        wrap.write(uint8ArrayConcat([nonceLength, nonce.slice()]))

        // Read our nonce from the crypto stream
        let ourNonceRaw = (await wrap.read())
        const ourNonceRawBuffer = ourNonceRaw.slice()
        const ourNonceRawView = new DataView(ourNonceRawBuffer.buffer, ourNonceRawBuffer.byteOffset, ourNonceRawBuffer.byteLength)
        dataLength = ourNonceRawView.getInt32(0)
        ourNonceRaw = ourNonceRaw.shallowSlice(4, dataLength + 4) // Unbox expects a BufferList, so shallow slice here
        expect(ourNonceRaw.slice()).to.not.eql(state.proposal.out.rand) // The nonce should be encrypted
        const { value: ourNonce } = await unbox([ourNonceRaw]).next()

        // Verify our nonce is correct
        expect(ourNonce.slice()).to.eql(state.proposal.out.rand)
      })()
    ])

    expect(result.remotePeer.pubKey).to.exist()
    expect(result.remotePeer.pubKey.bytes).to.eql(remotePeer.pubKey.bytes)
  })
})
