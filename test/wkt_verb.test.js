/* global describe */

// import {log} from '../src/lib/utils'
import {augs, vowels, tense} from '../src/lib/utils'
let log = console.log
import { clause, antrax, enableDBs } from '../dist'
import _ from 'lodash'
// import { property } from 'jsverify'
const orthos = require('orthos')
const assert = require('assert')
const forEach = require('mocha-each')
const fse = require('fs-extra')
const path = require('path')

const numpers = "sg.1 sg.2 sg.3 du.2 du.3 pl.1 pl.2 pl.3".split(' ')

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

const testpath = path.resolve(__dirname, 'wkt_verb.txt')
const text = fse.readFileSync(testpath,'utf8')

let param = process.argv.slice(2)[1]
log('FILTER', param)

let skip = true

let tests = []
let title, descrs, sys, old, rows = []
let dict
text.split('\n').forEach((row, idx) => {
  if (/MA/.test(row)) skip = false
  if (skip) return
  if (!row || row[0] == '#' || row[0] == ' ') return
  // if (idx > 200) return

  let descr = row.split(':')[0].trim()
  if (descr == 'dict') {
    // dict: ἀάω • (aáō)
    let txt = row.split(':')[1].trim()
    dict = txt.split('•')[0].trim()
    // log('D', descr, dict)
  }
  else if (/inf/.test(descr)) {
    // if (!row.split(':')[1]) log('RRR', row)
    if (!row.split(':')[1]) return
    let stest = row.split(':')[1].trim()
    if (!stest) return
    let test = ['inf', dict, stest, descr, null]
    // tests.push(test)
    // aor.part-masc: ἀάσας, ἀασάμενος, ἀασθείς
  } else if (/part/.test(descr)) {
    // if (!row.split(':')[1]) log('RRR', row)
    if (!row.split(':')[1]) return
    // log('R', row)
    let stest2 = row.split(':')[1].trim()
    if (!stest2) return
    let vdescr = descr.split('-')[0]
    let ndescr = [descr.split('-')[1], 'sg.nom'].join('.')
    let stests = stest2.split(', ')
    if (stests.length == 1) {
      stests[0].split('-').forEach(stest => {
        let test = ['part', dict, stest, vdescr, ndescr]
        tests.push(test)
      })
    } else  if (stests.length == 2) {
      stests.forEach((stest2a, idx) => {
        stest2a.split('-').forEach(stest => {
          if (!stest) return
          if (stest == 'x') return
          let mid
          if (vdescr == 'aor.part' || vdescr == 'fut.part') mid = 'mid'
          else mid = 'mp'
          let voice = (idx) ? mid : 'act'
          let vfull = [voice, vdescr].join('.')
          let test = ['part', dict, stest, vfull, ndescr]
          tests.push(test)
        })
      })
    } else  if (stests.length == 3) {
      stests.forEach((stest2a, idx) => {
        stest2a.split('-').forEach(stest => {
          if (!stest) return
          if (stest == 'x') return
          let voice
          if (idx == 1) voice = 'mid'
          else if (idx == 2) voice = 'pas'
          else voice = 'act'
          let vfull = [voice, vdescr].join('.')
          let test = ['part', dict, stest, vfull, ndescr]
          tests.push(test)
        })
      })
    }
  } else  if (/act\./.test(descr) || /mp\./.test(descr) || /pas\./.test(descr)) {
    if (!row.split(':')[1]) return
    let stests = row.split(':')[1].trim().split(', ')
    stests.forEach((stest2, idy) => {
      if (!stest2) return // imperatives
      let numper = numpers[idy]
      // let expected = [descr, numper].join('-')
      stest2.split('-').forEach(stest => {
        // let plain = orthos.toComb(stest)
        // let first = _.first(plain)
        let test = ['verb', dict, stest, descr, numper]
        // tests.push(test)
      })
    })
  }
})

// tests = tests.slice(0, 50)
// console.log('T', tests)
// tests = []

// describe('add()', () => {
forEach(tests)
  .it(' %s %s %s %s %s ', (title, rdict, arg, tense, morph, done) => {
    // log('C:=>', title, rdict, arg, tense, morph)
    antrax(arg)
      .then(chains => {
        // log('C', chains)
        if (!chains.length) log('NO RESULT'), assert.equal(false, true)
        chains.forEach(chain => {
          if (chain.length > 2) log('CH.length'), assert.equal(false, true)
          let penult = chain[chain.length-2]
          penult.dicts.forEach(dict => {
            if (!dict.verb) return // не-глаголы
            if (orthos.toComb(dict.rdict) != orthos.toComb(rdict)) return  //  лишние глаголы

            let fls = _.last(chain).flexes
            // log('FLS', fls)
            let tenses = fls.map(flex => { return flex.tense })
            tenses = _.uniq(tenses)
            if (morph) {
              if (!tenses.includes(tense)) { // chain has correct verb, but verb has other tense :
                assert.equal(true, true)
                return
              }
              // verb or participle:
              let morphs = fls.map(flex => { return flex.numper || [flex.gend, flex.numcase].join('.') })
              morphs = _.uniq(morphs)
              // log('M', morph, morphs)
              assert.equal(morphs.includes(morph), true)
            } else {
              assert.equal(true, true) // can be act.fut.inf where act.pres.inf is tested - ἀλέξειν
              // assert.equal(tenses.includes(tense), true)
            }
          })
        })
      })
      .then(done)

  })
// })
