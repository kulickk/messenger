const rules = require('./webpack.rules');

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader', options: { modules: { auto: true } } }],
});

module.exports = {
  module: { rules },
  resolve: {
    fallback: { path: false, fs: false, crypto: false },
  },
};
