/**
 * Listener Line backend: a Google Apps Script web app that stores clips in Drive.
 * Deploy as: Execute as "Me", Who has access "Anyone". See SETUP.md.
 *
 * Script Properties:
 *   FOLDER_ID     Drive folder that holds clips/, episodes.json and board.json
 *   HOST_KEY      the /host password (plain text; the site stores only its SHA-256)
 *   NOTIFY_EMAIL  where new-clip emails go (comma-separate for several)
 */

// Bump when Code.gs changes, so `curl <url>` shows which version is deployed.
var VERSION = 2; // 2: episode descriptions

var KINDS = ['question', 'thought', 'intro'];
var DESTS = ['lwit', 'upcoming'];
var MAX_AUDIO_B64 = 4 * 1024 * 1024; // ~3 MB of MP3; 2:00 at 64 kbps is ~1 MB
var MAX_SECONDS = 125;
var MIN_ELAPSED_MS = 3000;
var RATE_LIMIT = 20; // listener submissions per window, across everyone
var RATE_WINDOW_S = 600;

// ---------------------------------------------------------------------------
// Entry points

function doGet() {
  return json_({ ok: true, data: { service: 'listener-line', version: VERSION, time: new Date().toISOString() } });
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var handler = PUBLIC_[req.action] || (HOST_[req.action] && requireHost_(req) && HOST_[req.action]);
    if (!handler) throw fail_('Unknown action.', 'bad_request');
    return json_({ ok: true, data: handler(req) });
  } catch (err) {
    if (err && err.code) return json_({ ok: false, error: err.message, code: err.code });
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, error: 'Something went wrong on our side. Try again in a minute.', code: 'server' });
  }
}

var PUBLIC_ = {
  getEpisodes: function () {
    return readJson_('episodes.json', []).filter(function (ep) { return ep.active; });
  },
  submit: submit_,
};

var HOST_ = {
  list: function () {
    var clips = [];
    var it = clipsFolder_().getFiles();
    while (it.hasNext()) {
      var f = it.next();
      var meta = parseMeta_(f);
      if (meta) clips.push(meta);
    }
    clips.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    return {
      clips: clips,
      board: readJson_('board.json', { updatedAt: new Date(0).toISOString(), segments: {} }),
      episodes: readJson_('episodes.json', []),
    };
  },

  clip: function (req) {
    var file;
    try {
      file = DriveApp.getFileById(String(req.id));
    } catch (e) {
      throw fail_('Clip not found.', 'not_found');
    }
    if (!inFolder_(file, clipsFolder_())) throw fail_('Clip not found.', 'not_found');
    return { audio: Utilities.base64Encode(file.getBlob().getBytes()) };
  },

  saveBoard: function (req) {
    return withLock_(function () {
      var current = readJson_('board.json', { updatedAt: new Date(0).toISOString(), segments: {} });
      if (String(req.base || '') < current.updatedAt) return { board: current, conflict: true };
      var board = req.board || {};
      if (typeof board.segments !== 'object' || board.segments === null) throw fail_('Bad board.', 'bad_request');
      var next = { updatedAt: new Date().toISOString(), segments: board.segments };
      writeJson_('board.json', next);
      return { board: next, conflict: false };
    });
  },

  saveEpisodes: function (req) {
    if (!Array.isArray(req.episodes)) throw fail_('Bad episode list.', 'bad_request');
    var seen = {};
    var eps = req.episodes.map(function (ep) {
      var id = String(ep.id || '').slice(0, 64);
      var title = String(ep.title || '').trim().slice(0, 120);
      if (!id || !title || seen[id]) throw fail_('Every episode needs a unique id and a title.', 'bad_request');
      seen[id] = true;
      var out = { id: id, title: title, active: !!ep.active };
      if (ep.note) out.note = String(ep.note).trim().slice(0, 80);
      if (ep.description) out.description = String(ep.description).trim().slice(0, 500);
      return out;
    });
    return withLock_(function () {
      writeJson_('episodes.json', eps);
      return eps;
    });
  },
};

// ---------------------------------------------------------------------------
// Submit

function submit_(req) {
  var s = req.submission || {};
  var isHost = !!req.key && checkKey_(req.key);

  if (!isHost) {
    // Bots fill hidden fields and send instantly. Fail quietly-ish either way.
    if (s.website) throw fail_('Something looked off. Try again.', 'spam');
    if (!(Number(s.elapsedMs) >= MIN_ELAPSED_MS)) throw fail_('That was quick. Give it another go.', 'spam');
    rateLimit_();
  }

  var name = String(s.name || '').trim().slice(0, 80);
  if (!name) throw fail_('Add a name to credit.', 'bad_request');
  if (s.consent !== true) throw fail_('Tick the box to say we can play it.', 'bad_request');
  if (KINDS.indexOf(s.kind) < 0 || DESTS.indexOf(s.dest) < 0) throw fail_('Bad request.', 'bad_request');
  var duration = Number(s.durationSec);
  if (!(duration > 0 && duration <= MAX_SECONDS)) throw fail_('Clips can be up to 2 minutes.', 'bad_request');
  var audio = String(s.audio || '');
  if (!audio || audio.length > MAX_AUDIO_B64) throw fail_('That clip is too large.', 'bad_request');

  var episode = null;
  if (s.dest === 'upcoming') {
    var eps = readJson_('episodes.json', []);
    episode = eps.filter(function (ep) { return ep.id === s.episodeId && (ep.active || isHost); })[0];
    if (!episode) throw fail_("That episode isn't taking clips any more. Pick another one.", 'bad_request');
  }

  var bytes;
  try {
    bytes = Utilities.base64Decode(audio);
  } catch (e) {
    throw fail_('That clip is corrupted. Try again.', 'bad_request');
  }
  // MP3s start with an ID3 tag or a frame sync; refuse anything else.
  if (!(bytes.length > 3 && ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || ((bytes[0] & 0xff) === 0xff && (bytes[1] & 0xe0) === 0xe0)))) {
    throw fail_("That doesn't look like audio.", 'bad_request');
  }

  var now = new Date();
  var meta = {
    name: name,
    email: s.email ? String(s.email).trim().slice(0, 120) : undefined,
    summary: s.summary ? String(s.summary).trim().slice(0, 200) : undefined,
    kind: s.kind,
    dest: s.dest,
    episodeId: episode ? episode.id : undefined,
    fromVideo: !!s.fromVideo,
    durationSec: Math.round(duration * 10) / 10,
    source: isHost ? 'host' : 'listener',
    createdAt: now.toISOString(),
  };

  var fileName = [
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm'),
    episode ? episode.id : 'lwit',
    meta.kind,
    name.replace(/[^\w-]+/g, '-').slice(0, 40),
  ].join('_') + '.mp3';

  var file = clipsFolder_().createFile(Utilities.newBlob(bytes, 'audio/mpeg', fileName));
  file.setDescription(JSON.stringify(meta));

  if (!isHost) notify_(meta, episode, file);
  return { id: file.getId() };
}

function notify_(meta, episode, file) {
  var to = prop_('NOTIFY_EMAIL', false);
  if (!to) return;
  try {
    var where = episode ? episode.title : 'Last Week in Tech';
    var lines = [
      meta.name + ' sent a ' + meta.kind + ' for ' + where + ' (' + Math.round(meta.durationSec) + 's' + (meta.fromVideo ? ', from video' : '') + ').',
      '',
      meta.summary ? '"' + meta.summary + '"' : '(no summary)',
      meta.email ? 'Email: ' + meta.email : '',
      '',
      'Listen: ' + file.getUrl(),
    ];
    MailApp.sendEmail({
      to: to,
      subject: 'Listener Line: new ' + meta.kind + ' from ' + meta.name,
      body: lines.join('\n'),
      replyTo: meta.email || undefined,
    });
  } catch (e) {
    console.warn('notify failed: ' + e);
  }
}

// ---------------------------------------------------------------------------
// Helpers

function requireHost_(req) {
  if (!checkKey_(req.key)) throw fail_('Wrong password.', 'unauthorized');
  return true;
}

function checkKey_(key) {
  var expected = prop_('HOST_KEY', true);
  var given = String(key || '');
  if (given.length !== expected.length) return false;
  var diff = 0;
  for (var i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function rateLimit_() {
  var cache = CacheService.getScriptCache();
  var bucket = 'rl_' + Math.floor(Date.now() / 1000 / RATE_WINDOW_S);
  var n = Number(cache.get(bucket) || 0);
  if (n >= RATE_LIMIT) throw fail_("We're getting a lot of clips right now. Try again in a few minutes.", 'rate_limited');
  cache.put(bucket, String(n + 1), RATE_WINDOW_S * 2);
}

function prop_(name, required) {
  var v = PropertiesService.getScriptProperties().getProperty(name);
  if (!v && required) throw new Error('Missing Script Property ' + name + '. See SETUP.md.');
  return v;
}

function rootFolder_() {
  return DriveApp.getFolderById(prop_('FOLDER_ID', true));
}

function clipsFolder_() {
  var root = rootFolder_();
  var it = root.getFoldersByName('clips');
  return it.hasNext() ? it.next() : root.createFolder('clips');
}

function inFolder_(file, folder) {
  var parents = file.getParents();
  while (parents.hasNext()) if (parents.next().getId() === folder.getId()) return true;
  return false;
}

function parseMeta_(file) {
  try {
    var meta = JSON.parse(file.getDescription() || '');
    meta.id = file.getId();
    meta.size = file.getSize();
    meta.url = file.getUrl();
    return meta;
  } catch (e) {
    return null; // not one of ours
  }
}

function readJson_(name, fallback) {
  var it = rootFolder_().getFilesByName(name);
  if (!it.hasNext()) return fallback;
  try {
    return JSON.parse(it.next().getBlob().getDataAsString());
  } catch (e) {
    return fallback;
  }
}

function writeJson_(name, value) {
  var root = rootFolder_();
  var it = root.getFilesByName(name);
  var body = JSON.stringify(value, null, 2);
  if (it.hasNext()) it.next().setContent(body);
  else root.createFile(name, body, 'application/json');
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw fail_('Busy saving. Try again.', 'busy');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function fail_(message, code) {
  var e = new Error(message);
  e.code = code;
  return e;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// Run once from the editor: creates the Drive folder and fills FOLDER_ID if it's empty.

function setup() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('FOLDER_ID')) {
    var folder = DriveApp.createFolder('Listener Line');
    props.setProperty('FOLDER_ID', folder.getId());
    console.log('Created Drive folder "Listener Line": ' + folder.getUrl());
  }
  clipsFolder_();
  if (!readJson_('episodes.json', null)) writeJson_('episodes.json', []);
  ['HOST_KEY', 'NOTIFY_EMAIL'].forEach(function (k) {
    if (!props.getProperty(k)) console.warn('Set Script Property ' + k + ' before deploying.');
  });
  console.log('Setup done. Folder: ' + rootFolder_().getUrl());
}
