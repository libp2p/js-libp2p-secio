'use strict'

const through = require('through2')
const lpm = require('length-prefixed-stream')
const forge = require('node-forge')

const createBuffer = forge.util.createBuffer

exports.writer = function etmWriter (insecure, cipher, mac) {
  const encode = lpm.encode()
  const pt = through(function (chunk, enc, cb) {
    cipher.update(createBuffer(chunk.toString('binary')))

    if (cipher.output.length() > 0) {
      const data = new Buffer(cipher.output.getBytes(), 'binary')
      mac.update(data)
      this.push(Buffer.concat([
        data,
        new Buffer(mac.digest(), 'binary')
      ]))
      // reset hmac
      mac.start()
    }

    cb()
  })

  return insecure.pipe(pt).pipe(encode)
}

exports.reader = function etmReader (insecure, decipher, mac) {
  const decode = lpm.decode()
  const pt = through(function (chunk, enc, cb) {
    const l = chunk.length

    // TODO: check that this mac.getMac().length() is correct
    const macSize = mac.getMac().length()

    if (l < macSize) {
      return cb(new Error(`buffer (${l}) shorter than MAC size (${macSize})`))
    }

    const mark = l - macSize
    const data = chunk.slice(0, mark)
    const macd = chunk.slice(mark)

    mac.update(data)
    const expected = new Buffer(mac.digest(), 'binary')
    // reset hmac
    mac.start()

    if (!macd.equals(expected)) {
      return cb(new Error(`MAC Invalid: ${macd} != ${expected}`))
    }

    // all good, decrypt
    decipher.update(data)

    if (decipher.output.length() > 0) {
      const data = new Buffer(decipher.output.getBytes(), 'binary')
      this.push(data)
    }

    cb()
  })

  return insecure.pipe(decode).pipe(pt)
}
