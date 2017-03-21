/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const support = require('../src/support')

describe('support', () => {
  describe('theBest', () => {
    it('returns the first matching element, preferring p1', () => {
      const order = 1
      const p1 = ['hello', 'world']
      const p2 = ['world', 'hello']

      expect(
        support.theBest(order, p1, p2)
      ).to.be.eql(
        'hello'
      )
    })

    it('returns the first matching element, preferring p2', () => {
      const order = -1
      const p1 = ['hello', 'world']
      const p2 = ['world', 'hello']

      expect(
        support.theBest(order, p1, p2)
      ).to.be.eql(
        'world'
      )
    })

    it('returns the first element if the same', () => {
      const order = 0
      const p1 = ['hello', 'world']
      const p2 = p1

      expect(
        support.theBest(order, p1, p2)
      ).to.be.eql(
        'hello'
      )
    })

    it('throws if no matching element was found', () => {
      expect(
        () => support.theBest(1, ['hello'], ['world'])
      ).to.throw(
        /No algorithms in common/
      )
    })
  })
})
