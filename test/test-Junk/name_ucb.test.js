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

const testpath = path.resolve(__dirname, 'name_ucb.txt')
const text = fse.readFileSync(testpath,'utf8')

let param = process.argv.slice(2)[1]
// log('PPP', param)

// let skip = true
let exps = {
  'du.nav': ['du.nom', 'du.acc', 'du.voc'],
  'du.gd': ['du.gen', 'du.dat'],
  'pl.nv': ['pl.nom', 'pl.voc']
}

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
  let exp = arr[0]
  let tstrs = arr[1]
  if (!tstrs) return
  tstrs.split(' ').forEach(tstr2 => {
    tstr2.split('-').forEach(tstr => {
      let arg = tstr.trim()
      let test = [arg, exp]
      tests.push(test)
    })
  })

})

tests = _.compact(tests)
// tests = tests.slice(0, 25)
// console.log('T', tests)
// tests = []

forEach(tests)
  .it('name %s %s ', (arg, exp, done) => {
    // log('->', arg, exp)
    antrax(arg)
      .then(chains => {
        if (!chains.length) log('NO CHS'), assert.equal(false, true)
        chains.forEach(chain => {
          // log('CH.length', chain.length)
          // if (chain.length > 2) log('CH.length'), assert.equal(false, true)
          let fls = _.flatten(chains.map(chain => { return _.last(chain).flexes }))
          let numcases = fls.map(flex => { return flex.numcase })
          // log('n', numcases)
          let ex = exps[exp] ? exps[exp] : [exp]
          let int = _.intersection(ex, numcases)
          // log('ex', ex, 'int', int)
          assert.equal(int.length > 0, true)
        })
        // assert.equal(pdicts.includes(pexp), true)
        })
      .then(done)
  })
