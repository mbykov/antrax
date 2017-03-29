var _ = require('underscore');

module.exports = utils();

function utils() {
    if (!(this instanceof utils)) return new utils();
    return this;
}

utils.prototype.clean = function(str) {
    return 'CLEAN'
}

utils.prototype.const = {
    'a': 'a1',
    'b': 'a2'
}

let modCorr = {}

modCorr['act.pres.ind'] = ['act.pres.ind', 'act.pres.opt', 'act.pres.sub', 'act.pres.imp', 'mid-pass.pres.ind', 'mid-pass.pres.opt', 'mid-pass.pres.sub', 'mid-pass.pres.imp', 'act.impf.ind', 'mid-pass.impf.ind', 'mid.impf.ind', 'act.pres.inf', 'mid.pres.inf', 'act.fut.ind', 'mid.fut.ind']
// , 'act.aor.opt', 'act.aor.sub', 'mid-pass.aor.opt', 'mid-pass.aor.sub' ???

modCorr['act.fut.ind'] = ['act.fut.ind', 'act.fut.opt', 'mid.fut.ind', 'mid.fut.opt', 'pass.fut.ind', 'pass.fut.opt', 'act.fut.inf', 'mid.fut.inf', 'act.aor.opt', 'act.aor.sub', 'mid-pass.aor.opt', 'mid-pass.aor.sub']

modCorr['act.aor.ind'] = ['act.aor.ind', 'mid-pass.aor.ind', 'act.aor.imp', 'mid-pass.aor.imp', 'pass.aor.ind', 'pass.aor.opt', 'pass.aor.sub', 'fut-pass.aor.ind', 'pass.aor.imp', 'pass.aor.inf', 'pass.fut.inf']

utils.prototype.modCorr = modCorr

// 'mid.impf.ind' - убрать, только mp.

let augmods = ['act.impf.ind', 'mid-pass.impf.ind', 'mid.impf.ind', 'act.aor.ind', 'mid-pass.aor.ind', 'act.ppf.ind', 'mid-pass.ppf.ind', 'pass.aor.ind', '', '', '', '', '', '', '', ]

utils.prototype.augmods = augmods

let augs = {
    'ἐ': '',
    // 'ἔ': '', // already converted to comb and plain
    'ἠ': 'ἀ',
    '': '',
    '': ''
}
utils.prototype.augs = augs

let pres = ['act.pres.ind', 'act.pres.opt', 'act.pres.sub', 'act.pres.imp', 'mid-pass.pres.ind', 'mid-pass.pres.opt', 'mid-pass.pres.sub', 'mid-pass.pres.imp', 'act.pres.inf', 'mid.pres.inf']
utils.prototype.pres = pres
