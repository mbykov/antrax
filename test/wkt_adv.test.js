/* global describe */

let log = console.log
import { antrax } from '../index'
import { setDBs } from '../lib/pouch'
import _ from 'lodash'
import {comb, plain} from 'orthos'
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

const testpath = path.resolve('/home/michael/greek/antrax/test/wkt_ad-2.txt')
const text = fse.readFileSync(testpath,'utf8')

let param = process.argv.slice(2)[1]

let skip = true

const marks = ['dict', 'nom', 'gen', 'dat' , 'acc' , 'voc' , 'adv' , 'caution' ]
const degrees = ['adv', 'comp', 'sup']

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
    tests.pop()
  } else {
    // log('ELSE')
  }
  // log('IDX', idx, mark)
})

// tests = tests.slice(0, 3)
// console.log('T', tests)
// tests = []

forEach(tests)
  .it('adv %s %s %s ', (rdict, arg, dgr, done) => {
    // log('->', rdict, arg, dgr)
    antrax(arg)
      .then(res => {
        if (!res.chains.length) log('NO RESULT'), assert.equal(false, true)

        let chains = _.flatten(res.chains)
        let dicts = _.flatten(chains.map(chain=> { return chain.dicts }))
        dicts = _.filter(dicts, dict=> { return dict.rdict == rdict })
        dicts = _.compact(_.flatten(dicts))
        if (!dicts.length) log('NO DICTS'), assert.equal(false, true)

        // assert.equal(true, true)
        dicts.forEach(dict => {
          let fls = _.filter(dict.fls, flex=> { return flex.degree})
          if (!fls.length) log('NO FLEX'), assert.equal(false, true)
          let degrees = _.map(fls, flex => { return flex.degree })
          assert.equal(degrees.includes(dgr), true)
        })
      })
      .then(done)
  })
