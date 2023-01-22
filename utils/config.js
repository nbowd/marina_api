const { Datastore } = require('@google-cloud/datastore');

const datastore = new Datastore({
    projectId: 'portfolio-bowdenn',
  });

module.exports = datastore