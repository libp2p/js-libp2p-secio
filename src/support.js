'use strict'

exports.exchanges = [
  'P-256',
  'P-384',
  'P-521'
]

exports.ciphers = [
  'AES-256',
  'AES-128',
  'Blowfish'
]

exports.hashes = [
  'SHA256',
  'SHA512'
]

// Determines which algorithm to use.  Note:  f(a, b) = f(b, a)
exports.theBest = (order, p1, p2) => {
  let first
  let second

  if (order < 0) {
    first = p2
    second = p1
  } else if (order > 0) {
    first = p1
    second = p2
  } else {
    return p1[0]
  }

  for (let firstCandidate of first) {
    for (let secondCandidate of second) {
      if (firstCandidate === secondCandidate) {
        return firstCandidate
      }
    }
  }

  throw new Error('No algorithms in common!')
}
