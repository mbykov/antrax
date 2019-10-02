//

import _ from 'lodash'
let path = require('path')
const fse = require('fs-extra');
const PouchDB = require('pouchdb')

// STREAM
let replicationStream = require('pouchdb-replication-stream');
PouchDB.plugin(replicationStream.plugin);
PouchDB.adapter('writableStream', replicationStream.adapters.writableStream);
let MemoryStream = require('memorystream');

import { verbkeys } from './verb-reg-keys'
import { namekeys } from './name-reg-keys'
const nkeys = _.values(namekeys)
const vkeys = _.values(verbkeys)
import {oxia, comb, plain} from 'orthos'
// import {oxia, comb, plain} from '../../../../greek/orthos'

const request = require('request')
const rp = require('request-promise')

const log = console.log
let dbs = []
const actives = ['flex', 'terms', 'wkt', 'lsj']

const opts = {
  "host": 'http://diglossa.org:5984',
  json: true
}

export function initialReplication(upath, cfg, batch_size) {
  cfg = [{dname: 'terms'}, {dname: 'flex'}, {dname: 'wkt'}, {dname: 'lsj'}, {dname: 'dvr'}, {dname: 'souda'} ]
  let pouchpath = path.resolve(upath, 'pouch')
  fse.emptyDirSync(pouchpath)
  let dnames = cfg.map(db=> { return db.dname })
  log('_________________________initReplication', cfg, dnames)
  log('_________________________initReplication', upath, pouchpath, batch_size)
  dnames = ['terms', 'wkt', 'flex']

  return Promise.all(dnames.map(function(dname) {
    let stream = new MemoryStream()
    return streamDB(upath, dname, stream, batch_size)
  }))
    .then(installed=>{
      log('_________________________installed', installed)
      cfg.forEach((dict, idx)=> {
        if (installed.includes(dict.dname)) dict.active = true, dict.sync = true, dict.idx = idx
        else dict.idx = 100 + idx
      })
      cfg = _.sortBy(cfg, 'idx')
      cfg = cfg.forEach((dict, idx)=> { dict.idx = idx})
      return cfg
    })
    .catch(function (err) {
      log('ERR-initReplication')
      dbs = []
      return []
    })
}

export function streamDB (upath, dname, stream, batch_size) {
  let dpath = path.resolve(upath, 'pouch', dname)
  let pouch = new PouchDB(dpath)
  pouch.dname = dname

  let spath = [opts.host, dname].join('/')
  let source = new PouchDB(spath, {skip_setup: true});
  log('___streamDB dname____', dname)
  log('___dpath____', dpath)
  log('___spath____', spath)

  // return pouch.info()
  return Promise.all([
    source.dump(stream, {
      batch_size: batch_size,
      // live: true,
      retry: true
    })
      .catch(err=> {
        log('ERR: DUMP', dname, spath, err)
      }),
    pouch.load(stream)
      .catch(err=> {
        log('ERR: LOAD', dname, dpath, err)
      })
  ])
    .then(res=> {
      log('______________ load res____', dname, res)
      dbs.push(pouch)
      return dname
    })
    .catch(err=> {
      log('ERR: stream dump err', dname, err)
      // return
    })
}

export function checkConnection (upath, dnames) {
  // log('--setDBs--', dnames)
  dnames.push('flex')
  dbs = []
  dnames.forEach((dn, idx) => {
    // if (dn == 'flex' || dn == 'terms') return
    let dpath = path.resolve(upath, 'pouch', dn)
    let pouch = new PouchDB(dpath)
    pouch.dname = dn
    dbs.push(pouch)
  })
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
  let db_flex = _.find(dbs, db=> { return db.dname == 'flex' })
  if (!db_flex) return Promise.resolve([])
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
  let dnames = dbs.map(db=> { return db.dname })
  let db_terms = _.find(dbs, db=> { return db.dname == 'terms' })
  if (!db_terms) return Promise.resolve([])
  return db_terms.allDocs({keys: wfs, include_docs: true})
    .then(function(res) {
      let rdocs = _.compact(res.rows.map(row => { return row.doc }))
      let docs = _.flatten(rdocs.map(rdoc => { return rdoc.docs }))
      docs.forEach(doc => { doc.dname = 'terms' })
      return docs
    })
}

export function getDB (wf, dname) {
  let db = _.find(dbs, db=> { return db.dname == dname })
  return db.get(wf)
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

export function readDictionary(upath, dname) {
  let local = setLocalDB(upath, dname)
  return local.allDocs({ include_docs: true, startkey: 'α', endkey: 'ω\ufff0'  })
    .then(res=> {
      let rdocs = _.compact(res.rows.map(row => { return row.doc }))
      return rdocs
    })
}

export function updateCurrent(upath, dname, newdocs) {
  determineKey(newdocs)
  return readDictionary(upath, dname)
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

export function delDictionary(upath, dname) {
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

// export function getLSJ(str) {
//   let lsj = _.find(dbs, db=> { return db.dname == str })
//   return lsj.get('description')
//     .then(descr=> {
//       return descr
//     })
// }

// export function cloneDB (upath, cfg, dname) {
//   log('__cloneDB', dname)
//   return loadDump (upath, dname)
//     .then(cfg=>{
//       return dname
//     })
//     .catch(function (err) {
//       log('ERR-initReplication', err.message)
//       return []
//     })
// }

// function loadDump (upath, dname, stream, batch_size) {
//   let dpath = path.resolve(upath, 'pouch', dname)
//   // log('_________________________dpath', dpath)
//   let pouch = new PouchDB(dpath)
//   return streamDB (upath, dname, stream, batch_size)
//   // return pouch.load(dumppath)
//     .then(cfg=>{
//       // return pouch.replicate.from('http://mysite.com/mydb');
//       pouch.info()
//         .then(info=> {
//           log('____db-info', dname, info)
//         })
//       return dname
//     })
//     .catch(function (err) {
//       log('ERR-loadDump', err.message)
//       return
//     })
// }

// export function get_Cfg (apath, upath) {
//   let pouchpath = path.resolve(upath, 'pouch')
//   fse.ensureDirSync(pouchpath)
//   let dnames = allDBnames(upath)
//   if (!dnames.length) return installDBs(apath, upath)
//   return Promise.resolve(initCfg(dnames))
// }

// export function readCfg(apath) {
//   let cfg = []
//   let srcpath = path.join(apath, 'dumps').replace('app.asar', 'app.asar.unpacked')
//   let filenames = fse.readdirSync(srcpath)
//   let descrnames = _.filter(filenames, fn=> { return fn.split('.')[1] == 'json'})
//   descrnames = _.filter(descrnames, dname=> { return dname != 'flex.json'} )
//   descrnames.forEach(descrname=>{
//     let dpath = path.resolve(srcpath, descrname)
//     let dname = descrname.replace('.json', '')
//     if (dname == 'flex') return
//     let descr = fse.readJsonSync(dpath)
//     if (actives.includes(dname)) descr.active = true, descr.sync = true
//     cfg.push(descr)
//   })
//   return cfg
// }

// function install_DBs (apath, upath) {
//   let srcpath = path.join(apath, 'dumps').replace('app.asar', 'app.asar.unpacked')
//   let pouchpath = path.resolve(upath, 'pouch')
//   let cfg = readCfg(apath)

//   fse.emptyDirSync(pouchpath)
//   let filenames = fse.readdirSync(srcpath)
//   let dumpnames = _.filter(filenames, fn=> { return fn.split('.')[1] == 'dump'})
//   // let descrnames = _.filter(filenames, fn=> { return fn.split('.')[1] == 'json'})
//   log('_________dumpnames', dumpnames)

//   return Promise.all(dumpnames.map(function (dumpname) {
//     let dname = dumpname.split('.')[0]
//     let dpath = path.resolve(upath, 'pouch', dname)
//     log('__ DNAME', dumpname, dname, dpath)
//     let pouch = new PouchDB(dpath)
//     pouch.dname = dname
//     dbs.push(pouch)

//     if (!actives.includes(dname)) return
//     let dumppath = path.resolve(srcpath, dumpname)
//     let dumpstr = fse.readFileSync(dumppath, 'utf8')
//     log('__loading string...', dumpname, dumppath, dumpstr.length)
//     return pouch.load(dumpstr)
//   })).then(function () {
//     let dnames = dbs.map(db=> { return db.dname })
//     log('_____dump done loading, dnames:', dnames)
//     let cfg = initCfg(dnames)
//     return cfg
//   }).catch(function (err) {
//     log('_____dump ERR', err)
//   })
// }

// function installDBs_copy (apath, upath) {
//   let srcpath = path.join(apath, 'pouch').replace('app.asar', 'app.asar.unpacked')
//   let pouchpath = path.resolve(upath, 'pouch')

//   try {
//     fse.ensureDirSync(pouchpath)
//     fse.copySync(srcpath, pouchpath, {
//       overwrite: true
//     })
//     let dnames = fse.readdirSync(pouchpath)
//     // log('--install-dbs-dnames--', dnames)
//     return dnames
//   } catch (err) {
//     log('ERR copying default DBs', err)
//   }
// }

// export function getCfgInfos (upath) {
//   let dnames = allDBnames(upath)
//   log('--cfg-infos-dnames--', dnames)
//   return Promise.all(dnames.map(function(dname) {
//     let dbpath = path.resolve(upath, 'pouch', dname)
//     let pouch = new PouchDB(dbpath, {skip_setup: true})
//     return Promise.all([
//       pouch.info()
//         .then(info=> {
//           info.dname = dname
//           return info
//         })
//         .catch(err=> {
//           if (err.reason == 'missing') return
//           log('catch info ERR', err)
//         }),
//       pouch.get('description')
//         .then(descr=> {
//           return descr
//         })
//         .catch(err=> {
//           if (err.reason == 'missing') return
//           log('catch descr ERR', err)
//         })
//     ])
//   }))
//     .then(infodescrs=> {
//       let infos = []
//       // log('--cfg-infos-infodescrs--', infodescrs)
//       dnames.forEach((dname, idx)=> {
//         let infodescr = infodescrs[idx]
//         if (!infodescr) return
//         let info = infodescr[0]
//         let descr = infodescr[1]
//         if (!info) return
//         if (!descr) descr = { name: dname, langs: 'grc' }
//         let dbinfo = { dname: dname, name: descr.name, size: info.doc_count, langs: descr.langs } // , source: descr.source
//         if (!descr) dbinfo.fake = true
//         infos.push(dbinfo)
//       })
//       return infos
//     })
// }

// function allDBnames(upath) {
//   let pouchpath = path.resolve(upath, 'pouch')
//   let dnames = fse.readdirSync(pouchpath)
//   dnames = _.filter(dnames, dname=> { return dname != 'flex' })
//   return dnames
// }

// function initCfg(dnames) {
//   let cfg = dnames.map((dname, idx)=> { return {dname: dname, idx: idx, active: true, sync: false } } )
//   return cfg
// }
