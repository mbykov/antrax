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

let cases = ['nom', 'gen', 'dat', 'acc', 'voc']
let nums // = ['sg', 'du', 'pl']
let marks = ['dict', 'nom', 'gen', 'dat' , 'acc' , 'voc' , 'adv' , 'caution' ]
const morphs = {
  '6': ['masc-fem.sg', 'neut.sg', 'masc-fem.du', 'neut.du', 'masc-fem.pl', 'neut.pl' ],
  '9': ['masc.sg', 'fem.sg',  'neut.sg', 'masc.du', 'fem.du', 'neut.du', 'masc.pl', 'fem.pl', 'neut.pl' ]
}

let tests = []
let rtests = []
let tdoc
let dict
let rows = text.split('\n')
rows.forEach((row, idx) => {
  if (!row) return
  if (row[0] == '#') return
  else if (row[0] == ' ') return
  // if (idx > 82) return
  row = row.trim()
  if (row == 'MA')
  { skip = false
    return }
  if (skip) return
  // dict: βαθύς • (bathús) m (feminine βαθεῖα, neuter βαθύ); first/third declension
  // dict: βάρβαρος • (bárbaros) m, f (neuter βάρβαρον); second declension (Attic, Ionic, Koine)
  // dict: ἁβρός • (habrós) m (feminine ἁβρά, neuter ἁβρόν); first/second declension (
  let arr = row.split(': ')
  let mark = arr[0].trim()
  if (!marks.includes(mark)) return
  let txt = arr[1]
  txt = txt.trim()
  let tarr = txt.split(', ')
  let size = tarr.length
  let morph = morphs[size]
  // log('R', size, row)
  if (mark == 'dict') {
    dict = txt.split('•')[0].trim()
    // log('dict:', dict)
    // tdoc = {dict: dict, tests: [] }
    // rtests.push(tdoc)
    rtests = []
  } else if (size == '6' || size == '9') {
    if (mark == 'nom') rtests = []
    tarr.forEach((arg2, idy) => {
      arg2.split('-').forEach(arg => {
        let morph = morphs[size][idy]
        let test = [dict, arg, morph, mark]
        rtests.push(test)
      })
    })
    if (mark == 'voc') {
      tests.push(rtests)
    }
  } else if (mark == 'adv') {
    // log('ADV', rtests.length)
    // tests[dict] = rtests
  } else if (mark == 'caution') {
    // log('CAU')
    // return
    tests.pop()
  } else {
    // log('ELSE')
    // tests[dict] = rtests
  }
  // log('IDX', idx, mark)
})

tests = _.flatten(tests)

// tests = tests.slice(0, 10)
console.log('T', tests.length)
// tests = []

forEach(tests)
  .it('adj %s %s %s %s ', (dict, arg, morph, kase, done) => {
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

          // let fls = _.flatten(chains.map(chain => { return _.last(chain).flexes }))
          let fls = _.last(chain).flexes
          let exps = fls.map(flex => { return [flex.gend, flex.numcase].join('.') })

          if (exps.length != _.uniq(exps).length) log('EXPS', exps)
          assert.equal(exps.length, _.uniq(exps).length) // результаты fls не повторяются

          let act = [morph, kase].join('.')
          // log('act:', act, 'exp:', exps)
          assert.equal(exps.includes(act), true)
          // assert.equal(true, true)
        })
      })
      .then(done)
  })
