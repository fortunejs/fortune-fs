'use strict'

var testAdapter = require('fortune/test/adapter')
var fsAdapter = require('./index')
const fortune = require('fortune')
const assert = require('node:assert/strict')

testAdapter(fsAdapter)

assert.doesNotThrow(() => {
  const concurrentReads = 1
  const store = fortune({}, {
    adapter: [fsAdapter, { concurrentReads }],
  })
  assert.equal(store.adapter.options.concurrentReads, concurrentReads)
})

assert.throws(() => {
  fortune({}, {
    adapter: [fsAdapter, { concurrentReads: 0 }],
  })
})
