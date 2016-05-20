/* eslint-env mocha */
'use strict'

const expect = require('chai').expect

const secio = require('../src')

describe('libp2p-secio', () => {
  it('exists', () => {
    expect(secio).to.exist
  })
})
