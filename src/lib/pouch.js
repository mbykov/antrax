//

import _ from 'lodash'

let fse = require('fs-extra')

let copydir = require('copy-dir')
const path = require('path')
const PouchDB = require('pouchdb')

let log = console.log

let dbs
let db_flex
let db_terms

function createZeroCfg(upath, aversion) {
  let upouchpath = path.resolve(upath, 'pouch')
  let fns = fse.readdirSync(upouchpath)

  let cfg = []
  fns.forEach((dn, idx) => {
    if (dn == 'cfg.json') return
    let dpath = path.resolve(upouchpath, dn)
    let cf = {name: dn, active: true, idx: idx}
    cfg.push(cf)
  })
  cfg = _.sortBy(cfg, ['idx'])
  let sfgpath = path.resolve(upouchpath, 'cfg.json')
  fse.writeJsonSync(sfgpath, cfg)
  let version = {version: aversion}
  let versionpath = path.resolve(upath, 'version.json')
  fse.writeJsonSync(versionpath, version)
  return cfg
}

function initDBs(upath, apath, aversion, isDev) {
  log('APATH', apath)
  let env = process.env.NODE_ENV
  log('NODE_ENV', env)
  let srcpath
  if (isDev) {
    srcpath = path.resolve(apath, 'pouch')
  } else {
    srcpath = path.resolve(apath, '../app.asar.unpacked/pouch')
  }
  let destpath = path.resolve(upath, 'pouch')
  log('init - SRC:', srcpath, 'DEST:', destpath)

  try {
    fse.ensureDirSync(destpath)
    fse.copySync(srcpath, destpath, {
      overwrite: true
    })
  } catch (err) {
    log('ERR copying default DBs', err)
  }
  let cfg = createZeroCfg(upath, aversion)
  return cfg
}

export function setDBs (upath, apath, isDev) {
  let pckg = require('../../package.json')
  let aversion = pckg.version
  let rewrite = false
  let versionpath = path.resolve(upath, 'version.json')
  let oldver = fse.readJsonSync(versionpath, { throws: false })
  if (!oldver) rewrite = true
  else if (oldver.version != aversion) rewrite = true
  let cfgpath = path.resolve(upath, 'pouch/cfg.json')
  let cfg = fse.readJsonSync(cfgpath, { throws: false })
  if (!cfg) rewrite = true
  if (rewrite) cfg = initDBs(upath, apath, aversion, isDev)

  let dbnames = _.compact(cfg.map(cf => { return (cf.active) ? cf.name : null }))

  dbs = []
  dbnames.forEach((dn, idx) => {
    if (dn == 'flex') return
    if (dn == 'terms') return
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
        fl.docs.forEach(doc => {
          doc.flex = fl._id
          result.push(doc)
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

export function getTerm (wf) {
  return db_terms.allDocs({keys: [wf], include_docs: true})
    .then(function(res) {
      let rdocs = _.compact(res.rows.map(row => { return row.doc }))
      let docs = _.flatten(rdocs.map(rdoc => { return rdoc.docs }))
      docs.forEach(doc => { doc.dname = 'term', doc.weight = 0 })
      return docs
    })
}
