var _ = require('underscore');

module.exports = utils();

function utils() {
    if (!(this instanceof utils)) return new utils();
    return this;
}

let modCorr = {}

modCorr['act.pres.ind'] = ['act.pres.ind', 'act.pres.opt', 'act.pres.sub', 'act.pres.imp', 'mp.pres.ind', 'mp.pres.opt', 'mp.pres.sub', 'mp.pres.imp', 'act.impf.ind', 'mp.impf.ind', 'mp.impf.ind', 'act.pres.inf', 'mid.pres.inf']

modCorr['act.fut.ind'] = ['act.fut.ind', 'act.fut.opt', 'mid.fut.ind', 'mid.fut.opt', 'pass.fut.ind', 'pass.fut.opt', 'act.fut.inf', 'mid.fut.inf', 'act.aor.opt', 'act.aor.sub', 'mp.aor.opt', 'mp.aor.sub', 'act.aor.inf']
// добавил сюда aor, чтобы найти λύσω - act.aor.sub

modCorr['act.aor.ind'] = ['act.aor.ind', 'mid.aor.ind', 'act.aor.opt', 'mid.aor.opt', 'act.aor.sub', 'mid.aor.sub', 'act.aor.imp', 'mid.aor.imp', 'pass.aor.opt', 'pass.aor.sub', 'fp.aor.ind', 'pass.aor.imp', 'act.aor.inf', 'mid.aor.inf',  'pass.aor.inf', 'pass.fut.inf']

modCorr['pass.aor.ind'] = ['pass.aor.ind', '']

utils.prototype.modCorr = modCorr

let augmods = ['act.impf.ind', 'mp.impf.ind', 'act.aor.ind', 'mid.aor.ind', 'act.ppf.ind', 'mp.ppf.ind', 'pass.aor.ind']

utils.prototype.augmods = augmods

let augs = {
    'ἐ': '',
    // 'ἔ': '', // already converted to comb and plain
    'ἠ': 'ἀ',
    'ἡ': 'ἁ',
    'ἦ': 'ἀ',
    'εἴ': 'ἐ',
    'ει': '', // чтобы не отрезать εἴ, которую я сейчас полностью не обрабатываю, просто наличие aug
    '': '',
    '': ''
}

utils.prototype.augs = augs

let pres = ['act.pres.ind', 'act.pres.opt', 'act.pres.sub', 'act.pres.imp', 'mp.pres.ind', 'mp.pres.opt', 'mp.pres.sub', 'mp.pres.imp', 'act.pres.inf', 'mid.pres.inf']
utils.prototype.pres = pres

// я пока что сбросил ударения при проверке stem + term = form
// let vterms = {
//     'w-verb': {
//         'act.pres.ind': 'ω',
//         'act.fut.ind': 'σω',
//         'act.aor.ind': 'σα',
//         '': '',
//         '': ''
//     },
//     'aw-contr': {
//         'act.pres.ind': 'αω',
//         'act.fut.ind': 'ησω',
//         'act.aor.ind': 'ησα',
//         '': '',
//         '': ''
//     },
//     'ew-contr': {
//         'act.pres.ind': 'εω',
//         'act.fut.ind': 'ησω',
//         'act.aor.ind': 'ησα',
//         '': '',
//         '': ''
//     },
//     'X-verb': {
//         'act.pres.ind': '',
//         'act.fut.ind': '',
//         'act.aor.ind': '',
//         '': '',
//         '': ''
//     },
//     'X-verb': {
//         'act.pres.ind': '',
//         'act.fut.ind': '',
//         'act.aor.ind': '',
//         '': '',
//         '': ''
//     },

// }
// utils.prototype.vterms = vterms
