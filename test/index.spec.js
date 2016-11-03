/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */
'use strict'

const pair = require('pull-pair/duplex')
const expect = require('chai').expect
const PeerId = require('peer-id')
const crypto = require('libp2p-crypto')
const parallel = require('async/parallel')
const series = require('async/series')
const ms = require('multistream-select')
const pull = require('pull-stream')
const Listener = ms.Listener
const Dialer = ms.Dialer

const secio = require('../src')

describe('libp2p-secio', () => {
  it('exports a tag', () => {
    expect(secio.tag).to.be.eql('/secio/1.0.0')
  })

  it('upgrades a connection', (done) => {
    const p = pair()
    createSession(p[0], (err, local) => {
      if (err) {
        return done(err)
      }

      createSession(p[1], (err, remote) => {
        if (err) {
          return done(err)
        }

        pull(
          pull.values([new Buffer('hello world')]),
          local
        )

        pull(
          remote,
          pull.collect((err, chunks) => {
            expect(err).to.not.exist
            expect(chunks).to.be.eql([new Buffer('hello world')])
            done()
          })
        )
      })
    })
  })

  it('works over multistream', (done) => {
    const p = pair()

    const listener = new Listener()
    const dialer = new Dialer()

    series([
      (cb) => parallel([
        (cb) => listener.handle(p[0], cb),
        (cb) => dialer.handle(p[1], cb)
      ], cb),
      (cb) => {
        listener.addHandler('/banana/1.0.0', (conn) => {
          createSession(conn, (err, local) => {
            if (err) {
              return done(err)
            }
            pull(
              local,
              pull.collect((err, chunks) => {
                expect(err).to.not.exist
                expect(chunks).to.be.eql([new Buffer('hello world')])
                done()
              })
            )
          })
        })
        cb()
      },
      (cb) => dialer.select('/banana/1.0.0', (err, conn) => {
        if (err) {
          return cb(err)
        }

        createSession(conn, (err, remote) => {
          if (err) {
            return cb(err)
          }
          pull(
            pull.values([new Buffer('hello world')]),
            remote
          )
          cb()
        })
      })
    ], (err) => {
      if (err) {
        throw err
      }
    })
  })
})

function createSession (insecure, cb) {
  crypto.generateKeyPair('RSA', 2048, (err, key) => {
    if (err) {
      return cb(err)
    }

    key.public.hash((err, digest) => {
      if (err) {
        return cb(err)
      }

      cb(null, secio.encrypt(new PeerId(digest, key), key, insecure))
    })
  })
}
