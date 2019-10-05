/* global describe */

// import {log} from '../src/lib/utils'
let log = console.log
import _ from 'lodash'
import { antrax } from '../index'
import { checkConnection } from '../lib/pouch'
// import { property } from 'jsverify'
import {comb, plain} from 'orthos'
// import {oxia, comb, plain} from '../../../../greek/orthos'
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
let dnames = ['wkt']
checkConnection(upath, dnames)

const testpath = path.resolve(__dirname, '../../test/wkt_verb.txt')
// const testpath = path.resolve('/home/michael/greek/antrax/test/wkt_verb.txt')
const text = fse.readFileSync(testpath,'utf8')

let param = process.argv.slice(2)[1]

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
          let test = ['inf', par.rdict, form, descr, '-']
          tests.push(test)
        })
      })
    })
  })

})

// tests = tests.slice(0, 2)
// console.log('T', tests)
// tests = []

// describe('add()', () => {
forEach(tests)
  .it(' %s %s %s %s %s ', (title, rdict, arg, tense, morph, done) => {
    // log('C:=>', title, rdict, arg, tense, morph)
    antrax(arg)
      .then(res => {
        // if (!res.chains.length) log('NO RESULT'), assert.equal(false, true) // comment cause of terms
        let chains = _.filter(res.chains, chain=> { return _.find(chain[0].dicts, dict=> { return dict.verb && dict.rdict == rdict }) })
        let dicts = _.map(chains, chain=> { return _.map(chain[0].dicts, dict=> { return _.find(dict.fls, flex=> { return flex.tense == tense }) ? dict : null }) })
        dicts = _.compact(_.flatten(dicts))
        let terms = _.filter(res.terms, dict=> { return dict.fls })
        terms = terms.map(dict=> { return _.find(dict.fls, flex=> { return flex.tense == tense }) ? dict : null })
        terms = _.compact(_.flatten(terms))
        dicts = dicts.concat(terms)
        if (!dicts.length) log('NO DICTS'), assert.equal(false, true)
        let verbs = _.filter(dicts, dict=> { dict.verb })
        let fls = verbs.map(dict=> { return dict.fls})
        fls = _.flatten(fls)

        fls.forEach(flex => {
          assert.equal(flex.numper, morph)
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
    row = row.split(' # ')[0]
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
    } else if (/Aorist/.test(descr)) {
      formstr = row.split(':')[1].trim()
      mark = 'aor'
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
