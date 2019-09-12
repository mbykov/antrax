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

// const testpath = path.resolve(__dirname, '../../test/wkt_name.txt')
const testpath = path.resolve('/home/michael/greek/antrax/test/wkt_name.txt')
const text = fse.readFileSync(testpath,'utf8')

let param = process.argv.slice(2)[1]
let skip = true

// let cases = ['nom', 'gen', 'dat', 'acc', 'voc']
let numbers = ['sg', 'du', 'pl']

let rtests = []
let tdoc
let rows = text.split('\n')

let dict
let formstr, restrict
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
    if (restrict) res.restrict = restrict
    parseGend(res)
    if (dict) rtests.push(res)
  }

  if (descr == 'dict') {
    let txt = row.split(':')[1].trim()
    dict = txt.split('•')[0].trim()
    formstr = txt.split('•')[1].trim()
    if (!/genitive /.test(formstr)) dict = null
    store = []
    restrict = null
  } else if (descr == 'restrict') {
    restrict =  row.split(':')[1].trim()
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
        if (!form) return
        let number = numbers[idx]
        if (doc.pl) number = 'pl'
        if (doc.restrict) number = doc.restrict.split(' ')[idx]
        let numcase = [number, kase].join('.')
        let test = [doc.dict, form, doc.gend, numcase]
        tests.push(test)
      })
    })
  })
})

tests = _.compact(tests)

// tests = tests.slice(0, 20)
// console.log('T', tests)
// tests = []

forEach(tests)
  .it('name %s %s %s %s ', (rdict, arg, gend, numcase, done) => {
    // log('--->', rdict, arg, gend, numcase)
    antrax(arg)
      .then(result => {
        // terms:
        let terms = _.filter(result.terms, dict=> { return dict.name })
        let tfls = _.compact(_.flatten(terms.map(term=> { return term.fls })))
        let numcases = _.compact(tfls.map(flex => { return flex.numcase }))
        if (numcases.length) {
          assert.equal(numcases.includes(numcase), true)
          return
        }
        // chains:
        if (!result.chains.length) log('NO CHAINS'), assert.equal(false, true)
        let chains = _.flatten(result.chains)
        let dicts = _.flatten(chains.map(chain=> { return chain.dicts }))
        dicts = _.filter(dicts, dict=> { return dict.rdict == rdict })
        let names = _.compact(_.flatten(dicts))
        if (!dicts.length) log('NO DICTS'), assert.equal(false, true)

        let gendnames = _.filter(names, dict => { return dict.gend == gend }) // ex. ἄνθος masc, neut
        // if (!gendnames.length) log('NO GEND'), assert.equal(false, true) // στίξ στίχε fem du.nom - correct, but στίχος - sg.voc

        gendnames.forEach(dict => {
          let fls = dict.fls
          let numcases = fls.map(flex => { return flex.numcase })
          assert.equal(numcases.includes(numcase), true)
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
  res.gend = gend
}
