/* global describe */

// import {log} from '../src/lib/utils'
let log = console.log
import _ from 'lodash'
import { antrax } from '../index'
import { setDBs } from '../lib/pouch'
// import { property } from 'jsverify'
import {comb, plain} from 'orthos'
const assert = require('assert')
const forEach = require('mocha-each')
const fse = require('fs-extra')
const path = require('path')

let unhandledRejectionExitCode = 0
process.on("unhandledRejection", (reason) => {
  // console.log("unhandled rejection:", reason)
  unhandledRejectionExitCode = 1
  throw reason
})
process.prependListener("exit", (code) => {
  if (code === 0) {
    process.exit(unhandledRejectionExitCode)
  }
})

let upath = path.resolve(process.env.HOME, '.config/MorpheusGreek (development)')
let dnames = ['wkt']
setDBs(upath, dnames)

const testpath = path.resolve(__dirname, '/home/michael/greek/antrax/test/comp_wkt_verb.txt')
const text = fse.readFileSync(testpath,'utf8')

let skip = true

let test, dict, head, tail, phead, ptail
let tests = []
let tabs, title, descrs, sys, old, rows = []
let idy = 0
text.split('\n').forEach(row => {
  if (/MA/.test(row)) skip = false
  if (skip) return
  row = row.trim()
  if (!row) return
  if (row[0] == '#') return
  if (row == 'MA') return

  let mark = row.split(':')[1]
  if (mark) {
    // tests.push(test)
    dict = mark.split('\(')[0].trim()
    // test = [dict]
  } else {
    let arg = row.split(' ')[0]
    let test = [dict, arg]
    tests.push(test)
  }

})

tests = _.compact(tests)
// tests = tests.slice(0, 50)
console.log('T', tests.length)
// tests = []

let nores = []

forEach(tests)
  .it('compound %s %s', (expected, arg, done) => {
    // log('cmp->', expected, arg)
    antrax(arg, true)
      .then(res => {
        if (!res.chains) {
          // log('no-res:',expected, arg)
          // assert.equal(true, false)
        }
        return

        // correct resut should be first:
        let chain = res.chains[0]
        // log('CH', arg, chain)
        if (chain.length == 2) {
          let second_verb = _.find(chain[1].dicts, dict=> { return comb(dict.rdict) == comb(expected) })
          if (chain[0].pref && second_verb) assert.equal(true, true)
          else {
            log('chain.length=2, no prefix or suffix', expected, arg, 'verb', second_verb)
            assert.equal(true, false)
          }
        } else if (chain.length == 3) {
          if (chain[1].conn && chain[2].suf) {
            let first_verb = _.find(chain[0].dicts, dict=> { return comb(dict.rdict) == comb(expected) })
            assert.equal(true, true)
          } else if (chain[0].pref && chain[1].pref ) {
            let last_verb = _.find(chain[2].dicts, dict=> { return comb(dict.rdict) == comb(expected) })
            assert.equal(true, true)
          } else {
            log('chain.length=3, err:', expected, arg, chain[0].dicts)
            assert.equal(true, false)
          }
        } else {
          log('chain.length', chain.length)
          assert.equal(true, false)
        }
      })
      .then(done)

  })
