/* global describe */

let log = console.log
import _ from 'lodash'
import { antrax } from '../index'
import { setDBs } from '../lib/pouch'
// const orthos = require('orthos')
import {oxia, comb, plain} from '../../../../greek/orthos'
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

const testpath = path.resolve('/home/michael/greek/antrax/test/wkt_part.txt')
const text = fse.readFileSync(testpath,'utf8')

let param = process.argv.slice(2)[1]

let skip = true

// let cases = ['nom', 'gen', 'dat', 'acc', 'voc']
let marks = ['dict', 'nom', 'gen', 'dat' , 'acc' , 'voc' , 'adv' , 'caution', 'part', 'verb' ]

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
let dict, verb
let tense

let rows = text.split('\n')
rows.forEach((row, idx) => {
  if (!row) return
  if (row[0] == '#') return
  else if (row[0] == ' ') return
  // if (idx > 25) return
  row = row.trim()
  // skip = false
  if (row == 'MA') skip = false
  if (skip) return

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
          let test = ['part', tense, verb, arg, gend, num, mark]
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
  } else if (mark == 'part') {
    tense = txt
  } else if (mark == 'verb') {
    verb = comb(txt)
  } else {
    // log('ELSE')
    // tests[dict] = rtests
  }
  // log('IDX', idx, mark)
})

tests = _.flatten(tests)

// tests = tests.slice(0, 10)
// console.log('T', tests)
// tests = []

forEach(tests)
  .it('%s %s %s %s %s %s ', (title, tense, rdict, arg, gend, num, kase, done) => {
    // log('--->', title, rdict, arg, gend, num, kase)
    antrax(arg)
      .then(res => {
        if (!res.chains.length) log('NO RESULT'), assert.equal(false, true)
        let chains = _.filter(res.chains, chain=> { return chain.length == 1 })
        if (!chains.length) log('no short chains'), assert.equal(false, true)
        let dicts = _.flattenDeep(chains.map(chain=> { return chain[0].dicts }))
        dicts = _.filter(dicts, dict=> { return comb(dict.rdict) == comb(rdict)})
        if (!dicts.length) log('no DICT'), assert.equal(true, false)
        let fls = dicts[0].fls
        let flex = _.filter(fls, flex=> { return flex.numcase == [kase, num].join('.') && flex.tense.replace('.part', '') == tense })
        if (!flex) log('no FLEX'), assert.equal(true, false)
      })
      .then(done)
  })
