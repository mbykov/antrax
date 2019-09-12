/* global describe */

let log = console.log
import { antrax } from '../index'
import { setDBs } from '../lib/pouch'
import _ from 'lodash'

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

// const testpath = path.resolve(__dirname, '../../test/wkt_ad-2.txt')
const testpath = path.resolve('/home/michael/greek/antrax/test/wkt_ad-2.txt')
const text = fse.readFileSync(testpath,'utf8')

let param = process.argv.slice(2)[1]

let skip = true

// let cases = ['nom', 'gen', 'dat', 'acc', 'voc']
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
  // if (idx > 125) return
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
  let size = tarr.length
  let tgends = gends[size]
  let tnums = nums[size]
  if (mark == 'dict') {
    dict = txt.split('•')[0].trim()
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
    // tests[dict] = rtests
  } else if (mark == 'caution') {
    tests.pop()
  } else {
    // tests[dict] = rtests
  }
  // log('IDX', idx, mark)
})

tests = _.flatten(tests)

// tests = tests.slice(0, 2)
// console.log('T', tests)
// tests = []

forEach(tests)
  .it('adj %s %s %s %s ', (rdict, arg, gend, num, kase, done) => {
    // log('--->', rdict, arg, gend, num, kase)
    antrax(arg)
      .then(result => {
        if (!result.chains.length) log('NO CHAIN'), assert.equal(false, true)
        result.chains.forEach(chain => {
          let lastseg = _.last(chain)
          if (!lastseg.dicts.length) log('NO DICTS'), assert.equal(false, true)
          let names = _.filter(lastseg.dicts, dict => { return dict.name && dict.ends && dict.rdict == rdict })
          if (!names.length) return // ἀγνῶτε - ἀγνῶτ+ε ; ἀγν+ῶτε

          names.forEach(dict => {
            let fls = dict.fls
            let gendflexes = _.filter(fls, flex => { return flex.gend == gend })
            if (!gendflexes.length) return // ἁβρός, ἁβρά, ἁβρόν, variant: ἁβρός, ἁβρόν, no fem
            let numcase = [num, kase].join('.')
            let numcases = gendflexes.map(flex => { return flex.numcase })
            assert.equal(numcases.includes(numcase), true)
          })

        })
      })
      .then(done)
  })
