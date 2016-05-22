/* eslint-env mocha */
'use strict'

const expect = require('chai').expect
const through = require('through2')
const bl = require('bl')
const PeerId = require('peer-id')
const duplexify = require('duplexify')

const secio = require('../src')

describe('libp2p-secio', () => {
  it('exists', () => {
    expect(secio).to.exist
  })

  describe('insecure length prefixed stream', () => {
    it('encodes', (done) => {
      const id = PeerId.create({bits: 64})
      const key = {}
      const pt = through()
      const insecure = duplexify(pt, pt)
      const s = new secio.SecureSession(id, key, insecure)

      // encoded on raw
      s.insecure.pipe(bl((err, res) => {
        expect(err).to.not.exist
        expect(res.toString()).to.be.eql('\u0005hello\u0005world')
        done()
      }))

      s.insecureLp.write('hello')
      s.insecureLp.write('world')
      insecure.end()
    })

    it('decodes', (done) => {
      const id = PeerId.create({bits: 64})
      const key = {}
      const pt = through()
      const insecure = duplexify(pt, pt)
      const s = new secio.SecureSession(id, key, insecure)

      // encoded on raw
      s.insecureLp.pipe(bl((err, res) => {
        expect(err).to.not.exist
        expect(res.toString()).to.be.eql('helloworld')
        done()
      }))

      s.insecure.write('\u0005hello')
      s.insecure.write('\u0005world')
      s.insecureLp.end()
    })
  })
})
