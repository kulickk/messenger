const rules = require('./webpack.rules');
const path  = require('path');
const CopyPlugin = require('copy-webpack-plugin');

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader', options: { modules: { auto: true } } }],
});

rules.push({
  test: /\.wasm$/,
  type: 'asset/resource',
});

module.exports = {
  module: { rules },
  resolve: {
    fallback: { path: false, fs: false, crypto: false },
  },
  experiments: {
    asyncWebAssembly: true,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'node_modules/tdweb/dist'),
          to:   'tdweb',
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
};
