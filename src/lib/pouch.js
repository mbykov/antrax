//

import _ from 'lodash'
import jetpack from "fs-jetpack"

const path = require('path')
const PouchDB = require('pouchdb')

let log = console.log

let dbs
let db_flex
let db_terms

function createZeroCfg(apath, aversion) {
  let jetData = jetpack.cwd(apath)
  let cfg = []
  let fns = jetData.list('pouch')
  fns.forEach((dn, idx) => {
    let dpath = ['pouch/', dn].join('')
    if (jetData.exists(dpath) !== 'dir') return
    let cf = {name: dn, active: true, idx: idx}
    cfg.push(cf)
  })
  cfg = _.sortBy(cfg, ['idx'])
  jetData.write('pouch/cfg.json', cfg)
  let version = {version: aversion}
  jetData.write('version.json', version)
  return cfg
}

function initDBs(upath, apath, aversion) {
  let srcpath = path.resolve(upath, 'pouch')
  let destpath = path.resolve(apath, 'pouch')
  const dest = jetpack.dir(destpath, { empty: true, mode: '755' });
  log('SRC_upath', srcpath)
  log('DEST_apath', dest.path())

  let dbnames = ['specs', 'terms', 'flex', 'wktname', 'wktverb' ]
  dbnames.forEach(dn => {
    const srcpath = path.resolve(upath, 'pouch', dn)
    const src = jetpack.cwd(srcpath)
    const destpath = path.resolve(apath, 'pouch', dn)
    const dest = jetpack.dir(destpath, { empty: true, mode: '755' });
    try {
      src.copy('.', dest.path(), {
        matching: ['*/**'],
        overwrite: true
      })
    } catch (err) {
      log('ERR copying default DBs', err)
    }
  })
  let cfg = createZeroCfg(apath, aversion)
  return cfg
}

export function setDBs (upath, apath) {
  const jetData = jetpack.cwd(apath)
  let pckg = require('../../package.json')
  let aversion = pckg.version
  let rewrite = false

  let oldver = jetData.read('version.json', 'json')
  if (!oldver) rewrite = true
  else if (oldver.version != aversion) rewrite = true
  let cfg = jetData.read('pouch/cfg.json', 'json')
  if (!cfg) rewrite = true
  if (rewrite) cfg = initDBs(upath, apath, aversion)

  let dbnames = _.compact(cfg.map(cf => { return (cf.active) ? cf.name : null }))

  dbs = []
  dbnames.forEach((dn, idx) => {
    let dpath = path.resolve(upath, 'pouch', dn)
    let pouch = new PouchDB(dpath)
    pouch.dname = dn
    pouch.weight = idx
    dbs.push(pouch)
  })
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
      return terms
    })
}
