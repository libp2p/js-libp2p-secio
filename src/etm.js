'use strict'

const BufferList = require('bl/BufferList')
const { InvalidCryptoTransmissionError } = require('libp2p-interfaces/src/crypto/errors')

exports.createBoxStream = (cipher, mac) => {
  return async function * (source) {
    for await (const chunk of source) {
      const data = await cipher.encrypt(chunk)
      const digest = await mac.digest(data)
      yield new BufferList([data, digest])
    }
  }
}

exports.createUnboxStream = (decipher, mac) => {
  return async function * (source) {
    for await (const chunk of source) {
      const l = chunk.length
      const macSize = mac.length

      if (l < macSize) {
        throw new InvalidCryptoTransmissionError(`buffer (${l}) shorter than MAC size (${macSize})`)
      }

      const mark = l - macSize
      const data = chunk.slice(0, mark)
      const macd = chunk.slice(mark)

      const expected = await mac.digest(data)

      if (!macd.equals(expected)) {
        throw new InvalidCryptoTransmissionError(`MAC Invalid: ${macd.toString('hex')} != ${expected.toString('hex')}`)
      }

      const decrypted = await decipher.decrypt(data)

      yield decrypted
    }
  }
}
