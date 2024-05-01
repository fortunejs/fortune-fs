# Fortune File System Adapter

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/fortunejs/fortune-fs/test.yml)
[![npm Version](https://img.shields.io/npm/v/fortune-fs.svg?style=flat-square)](https://www.npmjs.com/package/fortune-fs)
[![License](https://img.shields.io/npm/l/fortune.svg?style=flat-square)](https://raw.githubusercontent.com/fortunejs/fortune-fs/master/LICENSE)

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


## Options


| Option | Default |  |
| --- | --- | ---|
| `concurrentReads`| `128` | limits how many files can be read concurrently by `Adapter.find()` |

### Options Example

```js
const path = require('path')
const fortune = require('fortune')
const fsAdapter = require('fortune-fs')

const store = fortune(recordTypes, {
  adapter: [ fsAdapter, {
    // Absolute path to database directory.
    path: path.join(__dirname, 'db'),
    concurrentReads: 32
  } ]
})
```


## Troubleshooting

If you have a large number of records (files), you may encounter `Error: EMFILE: too many open files`. Set the `concurrentReads` [option](#options) to a lower value to resolve this.


## License

This software is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune-fs/master/LICENSE).
