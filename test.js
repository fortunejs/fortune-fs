'use strict'

var path = require('path')
var testAdapter = require('fortune/test/adapter')
var fsAdapter = require('./index')

testAdapter(fsAdapter)
