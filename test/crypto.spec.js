'use strict'

const tests = require('libp2p-interfaces/src/crypto/tests')
const SECIO = require('..')

tests({
  setup () {
    // Set up your crypto if needed, then return it
    return SECIO
  },
  teardown () {
    // Clean up your crypto if needed
  }
})
