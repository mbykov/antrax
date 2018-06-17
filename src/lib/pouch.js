//

import _ from 'lodash'
import jetpack from "fs-jetpack"

const path = require('path')
const PouchDB = require('pouchdb')

let log = console.log

let dbs
let db_flex
let db_terms

/*
  enable -  для консоли
*/

// убрать cfg, здесь cfg всегда должно уже быть :

export function dnames () {
  if (!dbs) return
  let dbnames = dbs.map(db => { return db.dname })
  return dbnames
}

export function enableDBs (upath) {
  const jetData = jetpack.cwd(upath)
  let cfg = jetData.read('pouch/cfg.json', 'json')
  cfg = _.sortBy(cfg, ['idx'])
  let dbnames = _.compact(cfg.map(cf => { return (cf.active) ? cf.name : null }))
  // log('ACT-DBNs:', dbnames)
  dbs = []
  dbnames.forEach((dn, idx) => {
    let dpath = path.resolve(upath, 'pouch', dn)
    let pouch = new PouchDB(dpath)
    pouch.dname = dn
    pouch.weight = idx
    dbs.push(pouch)
  })
  // log('DBS', dbs.length)
  let flexpath = path.resolve(upath, 'pouch', 'flex')
  db_flex = new PouchDB(flexpath)
  let termpath = path.resolve(upath, 'pouch', 'terms')
  db_terms = new PouchDB(termpath)
}

export function queryDBs (keys) {
  return Promise.all(dbs.map(function (db) {
    return db.allDocs({
      keys: keys,
      include_docs: true
    })
      .then(function (res) {
        if (!res || !res.rows) throw new Error('no dbn result')
        let rdocs = _.compact(res.rows.map(row => { return row.doc }))
        let docs = _.flatten(_.compact(rdocs.map(rdoc => { return rdoc.docs })))
        if (!docs.length) return []
        docs.forEach(doc => { doc.dname = db.dname, doc.weight = db.weight })
        return docs
      }).catch(function (err) {
        console.log('ERR GET DBs', err)
      })
  }))
}

export function getFlex (keys) {
  return db_flex.allDocs({keys: keys, include_docs: true})
    .then(function(res) {
      let rdocs = _.compact(res.rows.map(row => { return row.doc }))
      let result = []
      rdocs.forEach(fl => {
        fl.morphs.forEach(morph => {
          morph.flex = fl._id
          result.push(morph)
        })
      })
      // log('FLS', result)
      return result
    })
}

export function getTerms (keys) {
  return db_terms.allDocs({keys: keys, include_docs: true})
    .then(function(res) {
      let rdocs = _.compact(res.rows.map(row => { return row.doc }))
      let docs = rdocs.map(rdoc => { return rdoc.docs })
      let terms = {}
      _.flatten(docs).forEach(doc => {
        doc.dname = 'term'
        if (!terms[doc.term]) terms[doc.term] = []
        terms[doc.term].push(doc)
      })
      // log('A-TERMS', terms)
      return terms
    })
}
