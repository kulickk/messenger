module.exports = {
  entry: './src/main.js',
  module: {
    rules: require('./webpack.rules'),
  },
  // Keep Node.js-only packages out of the webpack bundle.
  // Use a function so that telegram/* sub-paths (telegram/sessions,
  // telegram/events, telegram/Password, …) all resolve at runtime from
  // the same require() cache, avoiding instanceof mismatches.
  externals: [
    function ({ request }, callback) {
      if (request === 'telegram' || request.startsWith('telegram/')) {
        return callback(null, 'commonjs ' + request)
      }
      callback()
    },
  ],
};
