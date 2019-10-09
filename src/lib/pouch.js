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

export function ensureDBdir (upath) {
  let pouchpath = path.resolve(upath, 'pouch')
  fse.emptyDirSync(pouchpath)
  dbs = []
}

export function streamDB (upath, dname, stream, batch_size) {
  let pouchpath = path.resolve(upath, 'pouch')
  fse.ensureDirSync(pouchpath)
  let dpath = path.resolve(upath, 'pouch', dname)
  fse.emptyDirSync(dpath)
  let pouch = new PouchDB(dpath)
  pouch.dname = dname

  let spath = [opts.host, dname].join('/')
  let source = new PouchDB(spath, {skip_setup: true});

  // return pouch.info()
  return Promise.all([
    source.dump(stream, {
      batch_size: batch_size,
      live: true,
      retry: true
    }),
      // .catch(err=> {
      //   console.log('ERR: DUMP', dname, spath, err.message)
      // }),
    pouch.load(stream)
      // .catch(err=> {
      //   console.log('ERR: LOAD', dname, dpath, err.message)
      // })
  ])
    .then(res=> {
      dbs.push(pouch)
      // pouch.close()
      return dname
    })
    // .catch(err=> {
    //   log('ERR: stream dump err', dname, err.message)
    //   // return
    // })
}

export function checkConnection (upath, dnames) {
  dbs = []
  dnames.forEach(dname => {
    let dpath = path.resolve(upath, 'pouch', dname)
    let pouch = new PouchDB(dpath)
    pouch.dname = dname
    dbs.push(pouch)
  })
}


export function queryDBs (keys) {
  let qdbs = _.filter(dbs, db=> { return db.dname != 'flex' && db.dname != 'terms' })
  return Promise.all(qdbs.map(function (db) {
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
