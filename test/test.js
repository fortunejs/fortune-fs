'use strict'

var testAdapter = require('fortune/test/adapter')
var fsAdapter = require('../index')
const fortune = require('fortune')
const fs = require('node:fs')
const run = require('tapdance')

testAdapter(fsAdapter)

run((assert, comment) => {
  comment('concurrentReads validation')

  const concurrentReads = 1

  const store = fortune({}, {
    adapter: [fsAdapter, { concurrentReads }],
  })

  assert(store.adapter.options.concurrentReads === concurrentReads, `adapter has expected concurrentReads value --- expected: ${store.adapter.options.concurrentReads} --- actual: ${concurrentReads}`)

  let thrown = false
  let expectedError

  try {
    fortune({}, {
      adapter: [fsAdapter, { concurrentReads: 0 }],
    })
  } catch (e) {
    thrown = true
    expectedError = e.message === 'concurrentReads must be > 0'
    if(!expectedError) {
      // only log the error if it was something we did not expect
      console.error(e)
    }
  }

  assert(thrown, 'concurrentReads 0 is not valid')
  assert(expectedError, 'got expected error for concurrentReads 0')
});

(async () => {

  run(async (assert, comment) => {
    comment('msgpack decode validation')

    const type = 'foo'
    const schema = {}
    schema[type] = { bar: Boolean }

    const store = fortune(
      schema,
      { adapter: [fsAdapter] })

    const emptyID = 1
    const validID = 3
    const corruptID = 6

    fs.mkdirSync(`db/${type}`, { recursive: true })
    fs.copyFileSync('test/empty-file', `db/${type}/${emptyID}`)
    fs.copyFileSync('test/valid-file', `db/${type}/${validID}`)
    fs.copyFileSync('test/corrupt-file', `db/${type}/${corruptID}`)

    let error = null

    try {
      await store.find(type, [emptyID])
    } catch (e) {
      error = e
    }

    assert(error.message.includes('Decode record failed. File is empty'), `empty error message is present: ${error.message}`)

    error = null

    try {
      await store.find(type, [corruptID])
    } catch (e) {
      error = e
    }

    assert(error.message.includes('Decode record failed. File is corrupt'), `corrupt error message is present ${error.message}`)

    let result = await store.find(type, [validID])
    assert(result.payload.records.length === 1, 'valid record is found')

    error = null

    try {
      await store.update(type, [{ id: emptyID }])
    } catch (e) {
      error = e
    }

    assert(error, 'trying to update an empty file fails: ' + error)

    error = null

    try {
      await store.update(type, [{ id: corruptID }])
    } catch (e) {
      error = e
    }

    assert(error, 'trying to update a corrupt file fails: ' + error)

    result = await store.create(type, [{ id: emptyID }, {id: corruptID}])
    assert(result.payload.records.length === 2, 'successfully replaced empty and corrupt files via store.create()')
  })

})()
