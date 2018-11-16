'use strict'

var path = require('path')
var fs = require('fs')
var msgpack = require('msgpack-lite')
var mkdirp = require('mkdirp')
var lockFile = require('lockfile')


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

            mkdirp(typeDir, function (error) {
              return error ? reject(error) : resolve()
            })
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
    ).then(function (files) {
      return Promise.all(map(files, function (file) {
        return new Promise(function (resolve, reject) {
          var filePath = path.join(dbPath, type, '' + file)

          fs.readFile(filePath, function (error, buffer) {
            var record

            if (error)
              return error.code === 'ENOENT' ? resolve() : reject(error)

            record = msgpack.decode(buffer)

            if (!(type in self.db)) self.db[type] = {}

            self.db[type][record[primaryKey]] = record

            return resolve()
          })
        })
      }))
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
        var lockPath = path.join(typeDir, update[primaryKey] + '.lock')

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
        var lockPath = path.join(typeDir, update[primaryKey] + '.lock')

        return new Promise(function (resolve, reject) {
          lockFile.unlock(lockPath, function (error) {
            return error ? reject(error) : resolve()
          })
        })
      }))
    }).then(function () {
      return count
    })
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
