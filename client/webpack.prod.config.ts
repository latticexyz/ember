import path from "path";
import webpack from "webpack";
import HtmlWebpackPlugin from "html-webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";

const commitHash = require("child_process")
  .execSync("git rev-parse --short HEAD")
  .toString()
  .replace(/(\r\n|\n|\r)/gm, "");

const config: webpack.Configuration = {
  mode: "production",
  target: "web",
  output: {
    path: path.join(__dirname, "/dist"),
    filename: "bundle-[contenthash:6].min.js",
    publicPath: "/",
  },
  entry: {
    index: "./src/Frontend/EntryPoints/index.tsx",
  },
  node: {
    global: true,
    __filename: true,
    __dirname: true,
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
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react", "@babel/preset-typescript"],
          },
        },
      },
      // {
      //   test: /\.(zkey\..?.?|wasm)$/i,
      //   type: "javascript/auto",
      //   use: [
      //     {
      //       loader: "file-loader",
      //       options: {
      //         name: "[name].[ext]",
      //         outputPath: "snarks",
      //       },
      //     },
      //   ],
      // },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: "asset/resource",
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      // only for react. images are loaded differently for phaser
      {
        test: /\.(png|jpe?g|gif)$/i,
        use: [
          {
            loader: "file-loader",
          },
        ],
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
    new webpack.DefinePlugin({
      "process.browser": JSON.stringify(true),
      "process.env.NODE_DEBUG": JSON.stringify(false),
    }),
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
      process: "process/browser",
    }),
  ],
};

export default config;
