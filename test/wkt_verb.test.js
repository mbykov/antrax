/* global describe */

// import {log} from '../src/lib/utils'
import {augs, vowels, tense} from '../src/lib/utils'
let log = console.log
import { clause, antrax, enableDBs } from '../dist'
import _ from 'lodash'
// import { property } from 'jsverify'
import {comb, plain} from '../../orthos'
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

let irregs = [ 'δράω', 'εἰμί', 'εἶμι', 'εἰσέρχομαι', 'ἔρχομαι', 'θάπτω',  'θύω', 'τίθημι', 'τρέφω', 'φημί' ]

let skip = true

let pars = parseText(text.split('\n'))

let tests = []

pars.forEach(par => {
  let descrs = par.data.map(line => { return line.descr })
  descrs = _.uniq(descrs)
  let voices = descrs.map(descr => { return descr.split('.')[0] })
  voices = _.uniq(voices)

  par.data.forEach(line => {
    line.forms.forEach((form2, idy) => {
      if (!form2) return
      form2.split('-').forEach(form => {
        if (!form) return
        let numper = numpers[idy]
        let test = ['verb', par.rdict, form, line.descr, numper]
        tests.push(test)
      })
    })
  })

  par.parts.forEach(line => {
    let descrs = line.descr.split('-')
    let rdescr = descrs[0]
    let gend = descrs[1]
    line.forms.forEach((form2, idy) => {
      if (!form2) return
      form2.split('-').forEach(form => {
        if (!form) return
        let voice = voices[idy]
        let descr
        if (rdescr.split('.').length == 3) descr = rdescr
        else descr = [voice, rdescr].join('.')
        let test = ['part', par.rdict, form, descr, gend]
        tests.push(test)
      })
    })
  })

  par.infs.forEach(line => {
    line.forms.forEach((form2, idy) => {
      if (!form2) return
      form2.split('-').forEach(form => {
        if (!form) return
        voices.forEach(voice => {
          let descr
          if (line.descr.split('.').length == 3) descr = line.descr
          else descr = [voice, line.descr].join('.')
          let test = ['inf', par.rdict, form, descr]
          tests.push(test)
        })
      })
    })
  })

})

// tests = tests.slice(0, 20)
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
        let corrchs = _.filter(chains, ch => { return ch[ch.length-2].dicts.map(dict => { return dict.rdict}).includes(rdict) })
        if (!corrchs.length) log('no correct chains'), assert.equal(false, true)
        corrchs.forEach(chain => {
          if (chain.length > 2) log('CH.length'), assert.equal(false, true)
          let penult = chain[chain.length-2]
          let verbs = _.filter(penult.dicts, dict => { return dict.verb })
          if (!verbs.length) log('no verb'), assert.equal(false, true)
          let cverbs = _.filter(verbs, dict => { return comb(dict.rdict) == comb(rdict) })
          if (!cverbs.length) log('no correct verb'), assert.equal(false, true)
          if (cverbs.length != 1) log('verb should be one', cverbs), assert.equal(false, true)
          cverbs.forEach(dict => {
            let fls = _.last(chain).flexes
            // log('FLS', fls)
            let tenses = fls.map(flex => { return flex.tense })
            tenses = _.uniq(tenses)
            assert.equal(tenses.includes(tense), true)

            if (morph) { // verb, or part, cause inf has no morph
              let morphs
              let pfls = _.filter(fls, flex => { return flex.gend })
              let vfls = _.filter(fls, flex => { return flex.numcase })
              if (title == 'part') morphs = pfls.map(flex => { return flex.gend })
              else if (title == 'verb')  morphs = vfls.map(flex => { return flex.numcase })
              // log('M', morph, morphs)
              assert.equal(morphs.includes(morph), true)
            } else {
              assert.equal(false, true)
            }
          })
        })
      })
      .then(done)

  })
// })

function parseText (rows, only) {
  let pars = []
  let rdict, dict, pres, futs, trns, trn
  let formstr, futstr
  let mark
  let store = []
  let parts = []
  let infs = []
  rows.forEach((row, idx) => {
    // if (idx > 61) return

    if (/MA/.test(row)) skip = false
    if (skip) return
    if (!row || row.slice(0,2) == '# ') return
    if (!row[0] == ' ') trn = row.trim()
    let descr = row.split(':')[0].trim()

    if (row.slice(0,2) == '#=' || descr == 'dict') {
      if (mark && formstr) {
        let res =  {pos: mark, rdict: rdict, dict: dict, formstr: formstr, data: store, parts: parts, infs: infs} // , trns: trns // TRNS, STORE
        let cres = _.clone(res)
        pars.push(cres)
      }
      store = []
      parts = []
      infs = []
      mark = null
    }

    if (descr == 'dict') {
      let txt = row.split(':')[1].trim()
      rdict = txt.split('•')[0].trim()
      dict = comb(rdict)
      trns = []
    } else if (/Present/.test(descr)) {
      if (!row.split(':')[1]) log('ROW', row)
      formstr = row.split(':')[1].trim()
      mark = 'pres'
    } else if (/Imperfect/.test(descr)) {
      formstr = row.split(':')[1].trim()
      mark = 'impf'
    } else if (/Future/.test(descr)) {
      formstr = row.split(':')[1].trim()
      mark = 'fut'
    } else if (/inf/.test(descr)) {
      let str = row.split(':')[1]
      if (!str) return
      str = str.trim()
      let forms = str.split(', ')
      let part = {descr: descr, forms: forms}
      infs.push(part)
    } else if (/\.part/.test(descr)) {
      let str = row.split(':')[1]
      if (!str) return
      str = str.trim()
      let forms = str.split(', ')
      let part = {descr: descr, forms: forms}
      parts.push(part)
    } else  if (/act\./.test(descr) || /mp\./.test(descr) || /mid\./.test(descr) || /pas\./.test(descr)) {
      // descr = descr.replace('mp.', 'mid.')
      let str = row.split(':')[1]
      if (!str) return
      let res = {descr: descr, forms: str.trim().split(', ')}
      store.push(res)
    } else if (row[0] == ' ') {
      if (trns) trns.push(trn)
    }
  })
  return pars
}
