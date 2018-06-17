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

const testpath = path.resolve(__dirname, 'wkt_ad-2.txt')
const text = fse.readFileSync(testpath,'utf8')

let param = process.argv.slice(2)[1]

let skip = true

// let cases = ['nom', 'gen', 'dat', 'acc', 'voc']
// let nums // = ['sg', 'du', 'pl']
// const morphs = {
//   '6': ['masc-fem.sg', 'neut.sg', 'masc-fem.du', 'neut.du', 'masc-fem.pl', 'neut.pl' ],
//   '9': ['masc.sg', 'fem.sg',  'neut.sg', 'masc.du', 'fem.du', 'neut.du', 'masc.pl', 'fem.pl', 'neut.pl' ]
// }
const marks = ['dict', 'nom', 'gen', 'dat' , 'acc' , 'voc' , 'adv' , 'caution' ]
const degrees = ['adv', 'adv.comp', 'adv.sup']

let tests = []
let rtests = []
let tdoc
let dict
let rows = text.split('\n')
rows.forEach((row, idx) => {
  if (!row) return
  if (row[0] == '#') return
  else if (row[0] == ' ') return
  // if (idx > 85) return
  row = row.trim()
  if (row == 'MA')
  { skip = false
    return }
  if (skip) return
  let arr = row.split(': ')
  let mark = arr[0].trim()
  if (!marks.includes(mark)) return
  let txt = arr[1]
  txt = txt.trim()
  let tarr = txt.split(', ')
  // log('R', size, row)
  if (mark == 'dict') {
    dict = txt.split('•')[0].trim()
  } else if (mark == 'adv') {
    // log('ADV', txt)
    let tarr = txt.split(', ')
    tarr.forEach((arg2, idy) => {
      if (arg2 == '-') return
      let args = arg2.split('-')
      args.forEach(arg => {
        if (!arg) return
        let dgr = degrees[idy]
        let test = [dict, arg, dgr]
        tests.push(test)
      })
    })
  } else if (mark == 'caution') {
    // log('CAUTION!')
    // tests.pop()
  } else {
    // log('ELSE')
  }
  // log('IDX', idx, mark)
})

// tests = tests.slice(0, 20)
// console.log('T', tests)
// tests = []

forEach(tests)
  .it('adv %s %s %s ', (dict, arg, dgr, done) => {
    // log('->', arg, exp)
    antrax(arg)
      .then(chains => {
        if (!chains.length) log('NO RESULT'), assert.equal(false, true)
        chains.forEach(chain => {
          // log('CH.length', chain.length)
          if (chain.length > 2) log('CH.length'), assert.equal(false, true)
          let penult = chain[chain.length-2]
          if (!penult.dict.name) return // глаголы
          if (penult.dict.gend) return // не-прилагательные
          if (orthos.toComb(penult.dict.rdict) != orthos.toComb(dict)) return

          let fls = _.last(chain).flexes
          let exps = fls.map(flex => { return flex.degree })
          let exp = exps[0]
          if (!exp) return // adj, but not adv - αἰπύς

          // log('exp:', exps, 'dgr', dgr)
          assert.equal(exp, dgr)
          // assert.equal(true, true)
        })
      })
      .then(done)
  })
