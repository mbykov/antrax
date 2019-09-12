/* global describe */

// import {log} from '../src/lib/utils'
import {augs, vowels, tense} from '../src/lib/utils'
let log = console.log
import { antrax } from '../dist'
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

const testpath = path.resolve(__dirname, 'name_ad_fgb.txt')
const text = fse.readFileSync(testpath,'utf8')

let param = process.argv.slice(2)[1]
// log('PPP', param)

let morphs = ['sg.nom', 'sg.gen', 'sg.dat', 'sg.acc', 'sg.voc', 'du.nom', 'du.gen', 'du.dat', 'du.acc', 'du.voc', 'pl.nom', 'pl.gen', 'pl.dat', 'pl.acc', 'pl.voc']

let test, dict, head, tail, phead, ptail
let tests = []
let tabs, title, descrs, sys, old, rows = []
let idy = 0
text.split('\n').forEach((row, idx) => {
  if (!row) return
  // if (idx > 35) return
  row = row.trim()
  if (row[0] == '#') return
  let arr = row.split(': ')
  let gend = arr[0]
  let tstrs = arr[1]
  if (!tstrs) return
  tstrs.split(/,? /).forEach((tstr2, idx) => {
    if (!tstr2) return
    tstr2.split('-').forEach(tstr => {
      let arg = tstr.trim()
      let morph = morphs[idx]
      let test = [arg, gend, morph]
      tests.push(test)
    })
  })

})

tests = _.compact(tests)
// tests = tests.slice(0, 25)
// console.log('T', tests)
// tests = []

forEach(tests)
  .it('name %s %s %s ', (arg, gend, morph, done) => {
    // log('->', arg, exp)
    antrax(arg)
      .then(chains => {
        if (!chains.length) log('NO CHS'), assert.equal(false, true)
        chains.forEach(chain => {
          // log('CH.length', chain.length)
          if (chain.length > 2) log('CH.length'), assert.equal(false, true)
          let fls = _.flatten(chains.map(chain => { return _.last(chain).flexes }))
          fls = _.filter(fls, flex => { return flex.name })
          let numcases = fls.map(flex => { return flex.numcase })
          assert.equal(numcases.includes(morph), true)
          let dict = chain[0].dicts[0]
          if (!dict) log('NO UNIQ DICT'), assert.equal(false, true)
          if (dict.name && dict.terms != 2) {
            // if (arg == 'ἀδίκου') log('A', arg, 'D', dict, dict.terms == 2)
            let gends = _.uniq(fls.map(flex => { return flex.gend }))
            assert.equal(gends.includes(gend), true)
          }
        })
      })
      .then(done)
  })
