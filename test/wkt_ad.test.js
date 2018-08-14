/* global describe */

// import {log} from '../src/lib/utils'
import {augs, vowels, tense} from '../src/lib/utils'
let log = console.log
import { clause, antrax, enableDBs } from '../dist'
import _ from 'lodash'
const orthos = require('orthos')
// let orthos = require('../../orthos');
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
let apath = path.resolve(__dirname, '../../egreek')
enableDBs(upath, apath)

const testpath = path.resolve(__dirname, 'wkt_ad-2.txt')
const text = fse.readFileSync(testpath,'utf8')

let param = process.argv.slice(2)[1]

let skip = true

let cases = ['nom', 'gen', 'dat', 'acc', 'voc']
let marks = ['dict', 'nom', 'gen', 'dat' , 'acc' , 'voc' , 'adv' , 'caution' ]

const gends = {
  '6': ['masc fem', 'neut', 'masc fem', 'neut', 'masc fem', 'neut' ],
  '9': ['masc', 'fem',  'neut', 'masc', 'fem', 'neut', 'masc', 'fem', 'neut' ]
}

const nums = {
  '6': ['sg', 'sg', 'du', 'du', 'pl', 'pl' ],
  '9': ['sg', 'sg',  'sg', 'du', 'du', 'du', 'pl', 'pl', 'pl' ]
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
  let tgends = gends[size]
  let tnums = nums[size]
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
        let gends = tgends[idy]
        gends.split(' ').forEach(gend => {
          let num = tnums[idy]
          let test = [dict, arg, gend, num, mark]
          rtests.push(test)
        })
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

// tests = tests.slice(0, 5)
// console.log('T', tests)
// tests = []

forEach(tests)
  .it('adj %s %s %s %s ', (rdict, arg, gend, num, kase, done) => {
    // log('->', rdict, arg, gend, num, kase)
    antrax(arg)
      .then(chains => {
        if (!chains.length) log('NO RESULT'), assert.equal(false, true)
        // remove other results:
        let corrchs = _.filter(chains, ch => { return ch[ch.length-2].dicts.map(dict => { return dict.rdict}).includes(rdict) })
        if (!corrchs.length) log('no correct rdict'), assert.equal(false, true)
        corrchs = _.filter(corrchs, ch => { return ch[ch.length-2].dicts.map(dict => { return !dict.gend } ) })
        if (!corrchs.length) log('no adj'), assert.equal(false, true)
        corrchs = _.filter(corrchs, ch => { return ch[ch.length-1].flexes.map(flex => { return flex.gend == gend}) })
        if (!corrchs.length) log('no correct flex'), assert.equal(false, true)

        corrchs.forEach(chain => {
          // log('CH.length', chain.length)
          if (chain.length > 2) log('CH.length'), assert.equal(false, true)
          let penult = chain[chain.length-2]
          let fls = _.last(chain).flexes
          let actuals = fls.map(flex => { return flex.numcase })
          let expected = [num, kase].join('.')
          // log('-------', actuals, expected)
          assert.equal(actuals.includes(expected), true)

          penult.dicts.forEach(dict => {
          })

        })
      })
      .then(done)
  })
