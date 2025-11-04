'use strict';
const { Setting } = require('../models');

let cachedSettings = null;

async function loadSystemSettings() {
  if (cachedSettings) return cachedSettings;

  const settings = await Setting.findAll();
  cachedSettings = settings.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
  return cachedSettings;
}

module.exports = { loadSystemSettings };
