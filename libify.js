/* eslint strict:0 */

'use strict';

const fs = require('fs');
const path = require('path');
const jsTokens = require('js-tokens');
const { getOptions } = require('loader-utils');

const mkdirp = require('mkdirp');

function get(file, basedir) {
  /* eslint no-param-reassign:0, prefer-template:0 */
  const ext = path.extname(file);
  let libfile = basedir + file.slice(basedir.length).replace('/src/', '/lib/');
  // support .ts and .tsx, .ts,.tsx => .js
  if (ext === '.ts' || ext === '.tsx') {
    return libfile.replace(/.tsx?$/, '.js');
  }
  if (ext === '' || (ext !== '.js' && ext !== '.json')) {
    libfile += '.js';
  }
  return libfile;
}

function replacement(filepath, content, basedir, options) {
  if (content.indexOf('__webpack_public_path__') === -1) {
    return content;
  }
  jsTokens.lastIndex = 0;
  const parts = content.match(jsTokens);
  const webpackConfigPath = path.relative(
    path.dirname(filepath),
    options.webpackConfigPath || path.join(basedir, 'webpack.config')
  );
  const publicPath = 'require(' + JSON.stringify(webpackConfigPath) + ')[0].output.publicPath';
  const appRevisionsPath = path.relative(
    path.dirname(filepath),
    options.appRevisionsPath || path.join(basedir, 'app-revisions.json')
  );
  // string val is module
  // string val is .
  // string val is exports
  // string val is
  // string val is =
  // string val is
  // string val is __webpack_public_path__
  // string val is
  // string val is +
  // string val is
  // string val is "src/frameworks/favicon.ico"
  // string val is ;
  const out = parts.map((val) => {
    if (val === '__webpack_public_path__') {
      return publicPath;
    }
    if (val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') {
      return 'require(' + JSON.stringify(appRevisionsPath) + ')[' + val + ']';
    }
    return val;
  })
  .join('');
  return out;
}

module.exports = function libify(content) {
  /* eslint consistent-return:0 */
  this.cacheable();
  const callback = this.async();
  const basedir = this.options.context;
  const options = getOptions(this);
  let filepath;

  if (!callback) {
    if (this.resourcePath.split(path.sep).indexOf('node_modules') !== -1) {
      return content;
    }

    filepath = get(this.resourcePath, basedir);

    if (filepath === this.resourcePath || filepath === this.resourcePath + '.js') {
      return content;
    }

    mkdirp.sync(path.dirname(filepath));
    fs.writeFileSync(filepath, replacement(filepath, content, basedir, options));
    return content;
  }

  // async mode
  if (this.resourcePath.split(path.sep).indexOf('node_modules') !== -1) {
    process.nextTick(() => callback(null, content));
    return;
  }

  filepath = get(this.resourcePath, basedir);

  if (filepath === this.resourcePath || filepath === this.resourcePath + '.js') {
    process.nextTick(() => callback(null, content));
    return;
  }

  mkdirp(path.dirname(filepath), (err) => {
    if (err) {
      callback(err);
      return;
    }
    content = replacement(filepath, content, basedir, options);
    fs.writeFile(filepath, content, fserr => callback(fserr, content));
  });
};
