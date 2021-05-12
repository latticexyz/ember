import webpack from "webpack";
import "webpack-dev-server";
import HtmlWebpackPlugin from "html-webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";
import ReactRefreshWebpackPlugin from "@pmmmwh/react-refresh-webpack-plugin";

import { Configuration as WebpackConfiguration } from "webpack";
import { Configuration as WebpackDevServerConfiguration } from "webpack-dev-server";

import { resolve } from "path";

interface Configuration extends WebpackConfiguration {
  devServer?: WebpackDevServerConfiguration;
}

const config: Configuration = {
  mode: "development",
  target: "web",
  entry: {
    index: "./src/Frontend/EntryPoints/index.tsx",
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    fallback: {
      fs: false,
      tls: false,
      net: false,
      path: false,
      zlib: false,
      http: "stream-http",
      https: "https-browserify",
      stream: require.resolve("stream-browserify"),
      assert: require.resolve("assert/"),
      events: require.resolve("events/"),
      buffer: require.resolve("buffer/"),
      util: require.resolve("util/"),
      crypto: false,
      //"process": require.resolve("process/browser"),
      os: require.resolve("os-browserify/browser"),
      "crypto-browserify": require.resolve("crypto-browserify"),
    },
  },
  module: {
    rules: [
      {
        test: /\.(ts|js)x?$/i,
        exclude: /node_modules/,
        include: resolve(__dirname, "src"),
        use: [
          {
            loader: "esbuild-loader",
            options: {
              loader: "tsx", // Or 'ts' if you don't need tsx
              target: "chrome90",
            },
          },
        ],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: "asset/resource",
        include: resolve(__dirname, "src", "Assets", "fonts"),
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
        include: resolve(__dirname, "src", "Frontend", "EntryPoints"),
      },
      // only for react. images are loaded differently for phaser
      {
        test: /\.(png|jpe?g|gif)$/i,
        use: [
          {
            loader: "file-loader",
          },
        ],
        include: resolve(__dirname, "src", "Assets"),
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "index.html",
    }),
    new CopyPlugin({
      patterns: [
        { from: "public", to: "public" },
        { from: "src/Assets", to: "Assets" },
      ],
    }),
    new webpack.HotModuleReplacementPlugin(),
    new ReactRefreshWebpackPlugin(),
    new webpack.DefinePlugin({
      "process.browser": JSON.stringify(true),
      "process.env.NODE_DEBUG": JSON.stringify(false),
    }),
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
      process: "process/browser",
    }),
  ],
  devtool: "inline-source-map",
  devServer: {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization",
    },
    port: 8081,
    compress: true,
    hot: true,
    historyApiFallback: {
      index: "/",
    },
  },
};

export default config;
