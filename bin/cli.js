#!/usr/bin/env node

const { run } = require('../src/index');

run(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
