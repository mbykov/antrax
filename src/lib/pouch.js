//

import _ from 'lodash'
let path = require('path')
const fse = require('fs-extra');
const PouchDB = require('pouchdb')

import { verbkeys } from './verb-reg-keys'
import { namekeys } from './name-reg-keys'
const nkeys = _.values(namekeys)
const vkeys = _.values(verbkeys)

import {oxia, comb, plain} from 'orthos'
// import {oxia, comb, plain} from '../../../../greek/orthos'

const log = console.log

let dbs = []
let db_flex
let db_terms
let db_comp

export function createCfg (apath, upath) {
  let pouchpath = path.resolve(upath, 'pouch')
  fse.ensureDirSync(pouchpath)
  let dnames = allDBnames(upath)
  if (!dnames.length) dnames = installDBs(apath, upath)
  return initCfg(dnames)
}

function allDBnames(upath) {
  let pouchpath = path.resolve(upath, 'pouch')
  let dnames = fse.readdirSync(pouchpath)
  dnames = _.filter(dnames, dname=> { return dname != 'flex' })
  return dnames
}

function initCfg(dnames) {
  let cfg = dnames.map((dname, idx)=> { return {dname: dname, idx: idx, active: true, sync: false } } )
  return cfg
}

export function createCfgInfos (upath) {
  let dnames = allDBnames(upath)
  log('--cfg-infos-upath--', upath)
  log('--cfg-infos-dnames--', dnames)
  return Promise.all(dnames.map(function(dname) {
    let dbpath = path.resolve(upath, 'pouch', dname)
    let pouch = new PouchDB(dbpath, {skip_setup: true})
    return Promise.all([
      pouch.info()
        .then(info=> {
          info.dname = dname
          return info
        })
        .catch(err=> {
          if (err.reason == 'missing') return
          else log('catch info ERR', err.reason)
          log('catch info ERR', err)
        }),
      pouch.get('description')
        .then(descr=> {
          return descr
        })
        .catch(err=> {
          if (err.reason == 'missing') return
          else log('catch descr ERR', err.reason)
          log('catch descr ERR', err)
        })
    ])
  }))
    .then(infodescrs=> {
      let infos = []
      log('--cfg-infos-infodescrs--', infodescrs)
      dnames.forEach((dname, idx)=> {
        let idescr = infodescrs[idx]
        if (!idescr) return
        let info = idescr[0]
        let descr = idescr[1]
        if (!info || !descr) return
        let dbinfo = { dname: dname, name: descr.name, size: info.doc_count, langs: descr.langs, source: descr.source }
        infos.push(dbinfo)
      })
      return infos
    })
}

export function setDBs (upath, dnames) {
  // log('--setDBs--', dnames)
  dbs = []
  dnames.forEach((dn, idx) => {
    if (dn == 'flex' || dn == 'terms') return
    let dpath = path.resolve(upath, 'pouch', dn)
    let pouch = new PouchDB(dpath)
    pouch.dname = dn
    dbs.push(pouch)
  })

  let flexpath = path.resolve(upath, 'pouch', 'flex')
  db_flex = new PouchDB(flexpath)
  let termpath = path.resolve(upath, 'pouch', 'terms')
  db_terms = new PouchDB(termpath)
}

function installDBs (apath, upath) {
  let srcpath = path.join(apath, 'pouch').replace('app.asar', 'app.asar.unpacked')
  let pouchpath = path.resolve(upath, 'pouch')

  try {
    fse.ensureDirSync(pouchpath)
    fse.copySync(srcpath, pouchpath, {
      overwrite: true
    })
    let dnames = fse.readdirSync(pouchpath)
    // log('--install-dbs-dnames--', dnames)
    return dnames
  } catch (err) {
    log('ERR copying default DBs', err)
  }
}

export function queryDBs (keys) {
  return Promise.all(dbs.map(function (db) {
    return db.allDocs({
      keys: keys,
      include_docs: true
    })
      .then(function (res) {
        if (!res || !res.rows) throw new Error('no query dbs result')
        let rdocs = _.compact(res.rows.map(row => { return row.doc }))
        let docs = _.flatten(_.compact(rdocs.map(rdoc => { return rdoc.docs })))
        docs.forEach(doc => { doc.dname = db.dname })
        return docs
      }).catch(function (err) {
        console.log('ERR queryDBs', err)
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
          result.push(doc)
        })
      })
      return result
    })
}

export function getTerms (wfs) {
  return db_terms.allDocs({keys: wfs, include_docs: true})
    .then(function(res) {
      let rdocs = _.compact(res.rows.map(row => { return row.doc }))
      let docs = _.flatten(rdocs.map(rdoc => { return rdoc.docs }))
      docs.forEach(doc => { doc.dname = 'terms' })
      return docs
    })
}

export function createDB (upath, docs) {
  let local = 'local'
  let dpath = path.resolve(upath, 'pouch', local)
  let dbloc = _.find(dbs, db=> { return db.dname == local})
  if (dbloc) dbloc.destroy()
    .then(res=> {
      dbs = _.filter(dbs, db=> { return db.dname != local})
      createLocal(upath, docs)
    })
  else createLocal(upath, docs)
}

function createLocal(upath, docs) {
  let local = 'local'
  let dpath = path.resolve(upath, 'pouch', local)
  let pouch = new PouchDB(dpath)
  pouch.dname = local
  dbs.unshift(pouch)
  pouch.bulkDocs(docs)
    .then(res=> {
      // log('create-local: BULK-RES', docs)
    })
}

export function readDB(upath, dname) {
  let local = setLocalDB(upath, dname)
  return local.allDocs({ include_docs: true, startkey: 'α', endkey: 'ω\ufff0'  })
    .then(res=> {
      let rdocs = _.compact(res.rows.map(row => { return row.doc }))
      return rdocs
    })
}

export function updateDB(upath, dname, newdocs) {
  determineKey(newdocs)
  return readDB(upath, dname)
    .then(olddocs=> {
      // log('UPDATE old LOCAL:', olddocs)
      // log('UPDATE new LOCA:L', newdocs)
      let cleans = []
      olddocs.forEach(rdoc=> {
        let newdoc = _.find(newdocs, newdoc=> { return rdoc._id == newdoc._id })
        if (newdoc) newdoc.processed = true, rdoc.docs = newdoc.docs
        cleans.push(rdoc)
      })
      let news = _.filter(newdocs, dict=> { return !dict.processed })
      cleans.push(...news)
      let local = setLocalDB(upath, dname)
      return local.bulkDocs(cleans)
        .then(res=> {
          return {res: res, size: cleans.length}
        })
        .catch(err=> {
          console.log('ERR bulkDocs', err)
        })
    })
}

function setLocalDB(upath, dname) {
  let local = _.find(dbs, db=> { return db.dname == dname})
  if (!local) {
    let dpath = path.resolve(upath, 'pouch', dname)
    local = new PouchDB(dpath)
    local.dname = dname
    dbs.unshift(local)
  }
  return local
}

export function delDB(upath, dname) {
  let local = setLocalDB(upath, dname)
  return local.destroy().then(function (response) {
    return true
  }).catch(function (err) {
    console.log('Local DB destroy err:', err);
    return false
  });
}

function determineKey(rdocs) {
  rdocs.forEach(rdoc=> {
    rdoc.docs.forEach(doc=> {
      if (doc.key) return
      doc.dict = comb(doc.rdict)
      if (doc.name) {
        nkeys.forEach(nkey=> {
          let rekey = new RegExp(nkey + '$')
          let test = doc.dict.replace(rekey, '')
          if (test != doc.dict) doc.key = nkey
        })
      } else if (doc.verb) {
        vkeys.forEach(vkey=> {
          let rekey = new RegExp(vkey + '$')
          let test = doc.dict.replace(rekey, '')
          if (test != doc.dict) doc.key = vkey
        })
      }
    })
  })
}

// function checkCfg(apath, upath, dnames) {
//   // log('--checkCfg--init-dnames--', dnames)
//   let pouchpath = path.resolve(upath, 'pouch')
//   return Promise.all(dnames.map(function(dname) {
//     let dbpath = [pouchpath, dname].join('/')
//     let pouch = new PouchDB(dbpath) // проверить skip_setup
//     return pouch.info()
//       .then(info=> {
//         info.dname = dname
//         return info
//       })
//       .catch(err=> {
//         if (err.reason == 'missing') return
//         log('CFG-ERR:', err.reason)
//       })
//   }))
//     .then(infos=> {
//       infos = _.compact(infos)
//       infos = _.filter(infos, dict=> { return dict.dname != 'flex' })
//       let cfg = infos.map((dict, idx)=> { return {dname: dict.dname, idx: dict.idx, active: true, sync: false, size: dict.doc_count, langs: '', info: '' } } )
//       setDBs(upath, dnames)
//       log('--init-cfg--', cfg.length)
//       return cfg
//     })
// }
