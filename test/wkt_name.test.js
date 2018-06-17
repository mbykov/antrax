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

const testpath = path.resolve(__dirname, 'wkt_name.txt')
const text = fse.readFileSync(testpath,'utf8')

let param = process.argv.slice(2)[1]

let skip = true

let cases = ['nom', 'gen', 'dat', 'acc', 'voc']
let nums // = ['sg', 'du', 'pl']

let rtests = []
let tdoc
let rows = text.split('\n')
rows.forEach((row, idx) => {
  if (!row) return
  if (row[0] == '#') return
  // if (idx > 12) return
  row = row.trim()
  if (row == 'MA')
  { skip = false
    return }
  if (skip) return
  // log('R', row)
  let arr = row.split('dict: ')
  if (arr.length > 1) {
    // dict: ἀβακίσκος • (abakískos) m (genitive ἀβακίσκου); second declension
    let gend
    if (row.split(' m ').length > 1) gend = 'masc'
    else if (row.split(' m, f ').length > 1) gend = 'masc fem'
    else if (row.split(' f ').length > 1) gend = 'fem'
    else if (row.split(' n ').length > 1) gend = 'neut'
    let pl
    if (row.split(' pl ').length > 1) pl = true
    nums = ['sg', 'du', 'pl']
    let txt = arr[1].trim()
    let dict = txt.split('•')[0].trim()
    tdoc = {dict: dict, gend: gend, numcases: {}}
    if (pl) tdoc.pl = true
    rtests.push(tdoc)
  } else {
    if (/Singular, Plural/.test(row)) {
      nums = ['sg', 'pl']
      return
    } else if (/Dual, Plural/.test(row)) {
      nums = ['du', 'pl']
      return
    } else if (/Singular/.test(row)) {
      nums = ['sg']
      return
    } else if (/Plural/.test(row)) {
      nums = ['pl']
      return
    }
    let arr = row.split(': ')
    let kase = arr[0]
    if (!cases.includes(kase)) {
      log('BAD CASE!', row, 'case:', kase, 'nums', nums)
      throw new Error('case')
    }
    let args2 = arr[1].split(', ')
    if (args2.length != nums.length) {
      log('NO NUMBER!', row, 'nums:', nums,  'args2:', args2)
      throw new Error('number')
    }
    args2.forEach((arg2, idx) => {
      if (arg2 == '-') return
      let args = arg2.split('-')
      args.forEach(arg => {
        let num = nums[idx]
        let numcase = [num, kase].join('.')
        tdoc.numcases[numcase] = arg.trim()
      })
    })
  }

})

let tests = []
rtests.forEach(doc => {
  for (let numcase in doc.numcases) {
    // let morph = [doc.gend, numcase].join('.')
    let test = [doc.dict, doc.numcases[numcase], doc.gend, numcase]
    tests.push(test)
  }
})

tests = _.compact(tests)
// tests = tests.slice(0, 25)
// console.log('T', tests)
// tests = []

forEach(tests)
  .it('name %s %s %s %s ', (dict, arg, gend, numcase, done) => {
    // log('->', arg, exp)
    antrax(arg)
      .then(chains => {
        if (!chains.length) log('NO RESULT'), assert.equal(false, true)
        chains.forEach(chain => {
          // log('CH.length', chain.length)
          if (chain.length > 2) log('CH.length'), assert.equal(false, true)
          let penult = chain[chain.length-2]
          if (!penult.dict.name) return // глаголы
          if (!penult.dict.gend) return // прилагательные

          if (penult.dict.gend != gend) return // лишние сущ. не того рода αἴθων αἶθος, ἀδελφή - ἀδελφός
          // лишние решения, Γαλάτας - Γαλάτης
          if (orthos.toComb(penult.dict.rdict) != orthos.toComb(dict)) return

          let fls = _.last(chain).flexes

          // let exps = fls.map(flex => { return [flex.gend, flex.numcase].join('.') })
          // пока тест на уникальность не проходит -is-idos, -is-eos имеют -is в sg.nom: ἄγρωστις
          // assert.equal(exps.length, _.uniq(exps).length) // результаты fls не повторяются

          let numcases = fls.map(flex => { return flex.numcase })
          assert.equal(numcases.includes(numcase), true)
        })
      })
      .then(done)
  })
