'use strict'

var path = require('path')
var fs = require('fs')
var msgpack = require('msgpack-lite')
var { mkdirp } = require('mkdirp')
var lockFile = require('lockfile')

// in benchmarking tests with 124732 records,
// a concurrency limit of 128 was the sweet spot.
// lower limits took longer.
// higher limits caused performance degradation.
let concurrentReads = 128

/**
 * File system adapter. Available options:
 *
 * - `path`: absolute path to database directory. Default: `db`.
 */
module.exports = function (Adapter) {
  var DefaultAdapter = Adapter.DefaultAdapter
  var map, primaryKey

  function FileSystemAdapter (properties) {
    DefaultAdapter.call(this, properties)

    if (!this.options.path)
      this.options.path = path.join(__dirname, 'db')

    // No LRU, allow as many records as possible.
    delete this.options.recordsPerType

    if(Number.isInteger(this.options.concurrentReads)) {
      if(this.options.concurrentReads < 1) {
        throw new RangeError("concurrentReads must be > 0")
      }
      concurrentReads = this.options.concurrentReads
    }

    primaryKey = properties.common.constants.primary
    map = properties.common.map
  }

  FileSystemAdapter.features = {
    logicalOperators: true
  }

  FileSystemAdapter.prototype = Object.create(DefaultAdapter.prototype)


  FileSystemAdapter.prototype.connect = function () {
    var self = this
    var dbPath = self.options.path

    return DefaultAdapter.prototype.connect.call(self)
      .then(function () {
        return Promise.all(map(Object.keys(self.recordTypes), function (type) {
          return new Promise(function (resolve, reject) {
            var typeDir = path.join(dbPath, type)
            mkdirp(typeDir).then(resolve,reject)
          })
        }))
      })
  }


  FileSystemAdapter.prototype.disconnect = function () {
    return DefaultAdapter.prototype.disconnect.call(this)
  }


  FileSystemAdapter.prototype.create = function (type, records) {
    var self = this
    return DefaultAdapter.prototype.create.call(self, type, records)
      .then(function (records) {
        return writeRecords(path.join(self.options.path, type), records)
          .then(function () {
            return records
          })
      })
  }


  FileSystemAdapter.prototype.find = function (type, ids, options) {
    var self = this
    var dbPath = self.options.path
    var typeDir = path.join(dbPath, type)

    if (!('db' in self)) self.db = {}

    return (ids && ids.length ? Promise.resolve(ids) :
      new Promise(function (resolve, reject) {
        fs.readdir(typeDir, function (error, files) {
          return error ? reject(error) : resolve(files)
        })
      })
    ).then(async function (files) {
      const allThePromises = []
      let readsInFlight = 0
      const iterator = files[Symbol.iterator]()

      while (allThePromises.length < files.length) {
        if(readsInFlight >= concurrentReads) {
          // back off
          await pause(0)
        }
        else {
          allThePromises.push(
            new Promise(function (resolve, reject) {
              var filePath = path.join(dbPath, type, '' + iterator.next().value)
              readsInFlight +=1

              fs.readFile(filePath, function (error, buffer) {
                var record

                if (error)
                  return error.code === 'ENOENT' ? resolve() : reject(error)

                if(buffer.length === 0) {
                  return reject(new Error(`Decode record failed. File is empty: ${filePath}`))
                }
                else {
                  try {
                    record = msgpack.decode(buffer)
                  } catch (e) {
                    return reject(new Error(`Decode record failed. File is corrupt: ${filePath}`, { cause: e }))
                  }
                }

                if (!(type in self.db)) self.db[type] = {}

                self.db[type][record[primaryKey]] = record

                return resolve()
              })
            }).finally(()=>{
              readsInFlight -=1
            }))
        }
      }

      return Promise.all(allThePromises)
    }).then(function () {
      return DefaultAdapter.prototype.find.call(self, type, ids, options)
    })
  }


  FileSystemAdapter.prototype.update = function (type, updates) {
    var self = this
    var typeDir = path.join(self.options.path, type)
    var count

    return Promise.all(map(updates, function (update) {
      return new Promise(function (resolve, reject) {
        var lockPath = getLockPath(update[primaryKey])

        lockFile.lock(lockPath, function (error) {
          return error ? reject(error) : resolve()
        })
      })
    })).then(function () {
      return self.find(type, map(updates, function (update) {
        return update[primaryKey]
      }))
    }).then(function () {
      return DefaultAdapter.prototype.update.call(self, type, updates)
    }).then(function (result) {
      count = result
      return writeRecords(typeDir, map(updates, function (update) {
        return self.db[type][update[primaryKey]]
      }))
    }).then(function () {
      return Promise.all(map(updates, function (update) {
        var lockPath = getLockPath(update[primaryKey])

        return new Promise(function (resolve, reject) {
          lockFile.unlock(lockPath, function (error) {
            return error ? reject(error) : resolve()
          })
        })
      }))
    }).then(function () {
      return count
    })

    function getLockPath (id) {
      return path.join(self.options.path, type + '$' + id + '.lock')
    }
  }


  FileSystemAdapter.prototype.delete = function (type, ids) {
    var self = this
    var typeDir = path.join(self.options.path, type)

    return (ids ? Promise.resolve(ids) :
      new Promise(function (resolve, reject) {
        fs.readdir(typeDir, function (error, files) {
          return error ? reject(error) : resolve(files)
        })
      })
    ).then(function (memoizedIds) {
      return DefaultAdapter.prototype.delete.call(self, type, ids)
        .then(function (count) {
          return writeRecords(path.join(self.options.path, type), memoizedIds)
            .then(function () {
              return count
            })
        })
    })
  }

  return FileSystemAdapter

  function writeRecords (typeDir, records) {
    return Promise.all(map(records, function (record) {
      return new Promise(function (resolve, reject) {
        if (record === void 0) return resolve()

        if (typeof record === 'object')
          return writeRecord(typeDir, record).then(resolve, reject)

        return fs.unlink(path.join(typeDir, '' + record), resolve)
      })
    }))
  }

  function writeRecord (typeDir, record) {
    return new Promise(function (resolve, reject) {
      fs.writeFile(
        path.join(typeDir, '' + record[primaryKey]),
        msgpack.encode(record),
        function (error) {
          return error ? reject(error) : resolve()
        })
    })
  }
}

/**
 * Pause for an amount of time
 * @param {number} ms milliseconds to pause
 * @returns {promise}
 * @instance
 * @example
 * await pause(1 * 1000); // pause for 1 second
*/
function pause(ms) {
  return new Promise(resolve => { return setTimeout(resolve, ms) })
}
