/* global describe */

// import {log} from '../src/lib/utils'
import {augs, vowels, tense} from '../src/lib/utils'
let log = console.log
import { clause, antrax, enableDBs } from '../dist'
import _ from 'lodash'
// import { property } from 'jsverify'
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

const testpath = path.resolve(__dirname, 'wkt_name.txt')
const text = fse.readFileSync(testpath,'utf8')

let param = process.argv.slice(2)[1]

let skip = true

// let cases = ['nom', 'gen', 'dat', 'acc', 'voc']
let numbers = ['sg', 'du', 'pl']

let rtests = []
let tdoc
let rows = text.split('\n')

let dict
let formstr
let store = []

rows.forEach((row, idx) => {
  // if (idx > 31) return
  if (/MA/.test(row)) skip = false
  if (skip) return
  if (!row || row.slice(0,2) == '# ') return
  if (row[0] == ' ') return
  let descr = row.split(':')[0].trim()

  if (descr == 'dict') {
    let res =  {dict: dict, formstr: formstr, data: store} // ,
    parseGend(res)
    // if (!/genitive /.test(formstr)) return
    if (dict) rtests.push(res)
  }

  if (descr == 'dict') {
    let txt = row.split(':')[1].trim()
    dict = txt.split('•')[0].trim()
    formstr = txt.split('•')[1].trim()
    if (!/genitive /.test(formstr)) dict = null
    store = []
  } else if (['nom', 'gen', 'dat', 'acc', 'voc'].includes(descr)) {
    let str = row.split(':')[1]
    if (!str) return
    let res = {descr: descr, forms: str.trim().split(', ')}
    store.push(res)
  }
})

let tests = []
rtests.forEach(doc => {
  // let test = {dict: doc.dict}
  doc.data.forEach(line => {
    let kase = line.descr
    line.forms.forEach((form2, idx) => {
      if (!form2) return
      form2.split('-').forEach(form => {
        let number = numbers[idx]
        if (doc.pl) number = 'pl'
        let numcase = [number, kase].join('.')
        let test = [doc.dict, form, doc.gend, numcase]
        tests.push(test)
      })
    })
  })
})

// tests = _.compact(tests)
// tests = tests.slice(0, 25)
// console.log('T', tests)
// tests = []

forEach(tests)
  .it('name %s %s %s %s ', (rdict, arg, gend, numcase, done) => {
    // log('->', rdict, arg, gend, numcase)
    antrax(arg)
      .then(chains => {
        if (!chains.length) log('NO RESULT'), assert.equal(false, true)
        // remove other results:
        // log('==', chains[0][0])
        let corrchs = _.filter(chains, ch => { return ch[ch.length-2].dicts.map(dict => { return dict.rdict}).includes(rdict)
                                               && ch[ch.length-2].dicts.map(dict => { return dict.gend}).includes(gend)})
        if (!corrchs.length) log('no correct chains'), assert.equal(false, true)

        corrchs.forEach(chain => {
          // log('CH.length', chain)
          if (chain.length > 2) log('CH.length'), assert.equal(false, true)
          let penult = chain[chain.length-2]
          let names = _.filter(penult.dicts, dict => { return dict.name })
          if (!names.length) log('no name'), assert.equal(false, true)
          // let gends = _.filter(names, dict => { return dict.gend == gend })
          // if (!gends.length) log('no gend'), assert.equal(false, true)
          names.forEach(dict => {
            let fls = _.last(chain).flexes
            let numcases = fls.map(flex => { return flex.numcase })
            assert.equal(numcases.includes(numcase), true)
          })
        })
      })
      .then(done)
  })

function parseGend(res) {
  let head = res.formstr
  if (!head) return
  let gend
  if (head.split(' m ').length > 1) gend = 'masc'
  else if (head.split(' f ').length > 1) gend = 'fem'
  else if (head.split(' n ').length > 1) gend = 'neut'
  else if (head.split(' m f ').length > 1) gend = 'masc fem'
  if (head.split(' pl ').length > 1) res.pl = true
  // if (!gend) log('H', par.rdict, head)
  // if (!gend) return
  res.gend = gend
}
