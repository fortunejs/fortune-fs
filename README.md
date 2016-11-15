# Fortune File System Adapter

[![Build Status](https://img.shields.io/travis/fortunejs/fortune-fs/master.svg?style=flat-square)](https://travis-ci.org/fortunejs/fortune-fs)
[![npm Version](https://img.shields.io/npm/v/fortune-fs.svg?style=flat-square)](https://www.npmjs.com/package/fortune-fs)
[![License](https://img.shields.io/npm/l/fortune-fs.svg?style=flat-square)](https://raw.githubusercontent.com/fortunejs/fortune-fs/master/LICENSE)

This is a file system adapter for Fortune.js.

```sh
$ npm install fortune-fs --save
```


## Usage

```js
const path = require('path')
const fortune = require('fortune')
const fsAdapter = require('fortune-fs')

const store = fortune(recordTypes, {
  adapter: [ fsAdapter, {
    // Absolute path to database directory.
    path: path.join(__dirname, 'db')
  } ]
})
```


## License

This software is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune-fs/master/LICENSE).
