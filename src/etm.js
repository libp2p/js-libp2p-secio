'use strict'

const through = require('pull-through')
const pull = require('pull-stream')
const lp = require('pull-length-prefixed')

const toForgeBuffer = require('./support').toForgeBuffer

const lpOpts = {
  fixed: true,
  bytes: 4
}

exports.createBoxStream = (cipher, mac) => {
  const pt = through(function (chunk) {
    cipher.update(toForgeBuffer(chunk))

    if (cipher.output.length() > 0) {
      const data = new Buffer(cipher.output.getBytes(), 'binary')
      mac.update(data.toString('binary'))
      const macBuffer = new Buffer(mac.digest().getBytes(), 'binary')

      this.queue(Buffer.concat([data, macBuffer]))
      // reset hmac
      mac.start(null, null)
    }
  })

  return pull(
    pt,
    lp.encode(lpOpts)
  )
}

exports.createUnboxStream = (decipher, mac) => {
  const pt = through(function (chunk) {
    const l = chunk.length
    const macSize = mac.getMac().length()

    if (l < macSize) {
      return this.emit('error', new Error(`buffer (${l}) shorter than MAC size (${macSize})`))
    }

    const mark = l - macSize
    const data = chunk.slice(0, mark)
    const macd = chunk.slice(mark)

    // Clear out any previous data
    mac.start(null, null)

    mac.update(data.toString('binary'))
    const expected = new Buffer(mac.getMac().getBytes(), 'binary')

    // reset hmac
    mac.start(null, null)
    if (!macd.equals(expected)) {
      return this.emit('error', new Error(`MAC Invalid: ${macd.toString('hex')} != ${expected.toString('hex')}`))
    }

    // all good, decrypt
    decipher.update(toForgeBuffer(data))

    if (decipher.output.length() > 0) {
      const data = new Buffer(decipher.output.getBytes(), 'binary')
      this.queue(data)
    }
  })

  return pull(
    lp.decode(lpOpts),
    pt
  )
}
