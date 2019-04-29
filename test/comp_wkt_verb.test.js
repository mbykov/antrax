/* global describe */

// import {log} from '../src/lib/utils'
import {augs, vowels, tense} from '../src/lib/utils'
let log = console.log
import { antrax } from '../dist/antrax'
import { createDBs } from '../dist/lib/pouch'
import _ from 'lodash'
// import { property } from 'jsverify'
// const orthos = require('orthos')
let orthos = require('../../orthos');
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

// const testpath = path.resolve(__dirname, 'comp_wkt_verb.txt')
const testpath = path.resolve(__dirname, '/home/michael/greek/antrax/test/comp_wkt_verb.txt')
const text = fse.readFileSync(testpath,'utf8')

let param = process.argv.slice(2)[1]
// log('PPP', param)

let upath = path.resolve(__dirname, '../../')
createDBs(upath)


let skip = true

let test, dict, head, tail, phead, ptail
let tests = []
let tabs, title, descrs, sys, old, rows = []
let idy = 0
text.split('\n').forEach(row => {
  if (/MA/.test(row)) skip = false
  if (skip) return
  if (!row) return
  row = row.trim()
  if (row[0] == '#') return

  let mark = row.split(':')[1]
  if (mark) {
    tests.push(test)
    dict = mark.split('\(')[0].trim()
    head = dict.slice(0,3)
    tail = dict.slice(-3)
    phead = orthos.cplain(head)
    ptail = orthos.cplain(tail)
    test = {expected: dict, tests: []}
  } else {
    let arg = row.split('\(')[0].trim()
    let ahead = arg.slice(0,3)
    let atail = arg.slice(-3)
    let aphead = orthos.cplain(ahead)
    let aptail = orthos.cplain(atail)
    if (phead != aphead && ptail == aptail) test.tests.push(arg)
  }

})

tests = _.compact(tests)
tests = tests.slice(0, 1)
console.log('T', tests)
tests = []

tests.forEach(test => {
  let expected = test.expected
  // log('EXP', expected)
  forEach(test.tests)
    .it('comp %s ', (arg, done) => {
      // log('EXP', expected, 'ARG', arg)
      antrax(arg)
        .then(chains => {
          if (!chains.length) log('NO CHS'), assert.equal(false, true)
          chains = _.filter(chains, chain => { return chain.length > 2 }) // expected is in dicts already exists, i.e. length == 2
          if (!chains.length) return
          // προαναιρέω - два результата, оба с префиксом
          let exists = false
          chains.forEach(chain => {
            if (chain.length != 3 && chain.length != 4) log('CH.length'), assert.equal(false, true) // προσδιαιρέω - προσ-δι-αιρέω
            let rdicts = chain[chain.length-2].dicts.map(dict => { return dict.rdict} )
            let prdicts = _.uniq(rdicts).map(rdict => { return orthos.cplain(rdict)})
            let pexp = orthos.cplain(expected)
            // log('EXP', expected, 'ARG', arg, 'RDs', rdicts, 'PDs', prdicts, 'PEX', pexp)
            if (prdicts.includes(pexp)) exists = true
          })
          assert.equal(exists, true)
          // let dicts = chains.map(chain => { return chain[chain.length-2].d })
          // // let dicts = chains.map(chain => { return chain[chain.length-2].dicts[0].rdict })
          // log('DICTS', dicts)
          // let pdicts = dicts.map(d => { return orthos.cplain(d) })
          // let pexp = orthos.cplain(expected)
          // assert.equal(pdicts.includes(pexp), true)
        })
        .then(done)

    })
})
