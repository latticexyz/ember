import webpack from "webpack";
import HtmlWebpackPlugin from "html-webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";
import ReactRefreshWebpackPlugin from "@pmmmwh/react-refresh-webpack-plugin";
import { Configuration as WebpackConfiguration } from "webpack";
import { Configuration as WebpackDevServerConfiguration } from "webpack-dev-server";

interface Configuration extends WebpackConfiguration {
  devServer?: WebpackDevServerConfiguration;
}

const config: Configuration = {
  mode: "development",
  target: "web",
  //output: {
  //  path: path.join(__dirname, 'dist'),
  //  filename: '[name].bundle.js'
  //},
  entry: {
    index: "./src/index.tsx",
  },
  node: {
    global: true,
    __filename: true,
    __dirname: true,
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    fallback: {
      events: require.resolve("events/"),
      process: require.resolve("process/browser"),
      buffer: require.resolve("buffer/"),
      bufferutil: false,
      "utf-8-validate": false,
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
            plugins: [require("react-refresh/babel")],
            presets: ["@babel/preset-env", "@babel/preset-react", "@babel/preset-typescript"],
          },
        },
      },
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
      patterns: [{ from: "public", to: "public" }],
    }),
    new webpack.HotModuleReplacementPlugin(),
    new ReactRefreshWebpackPlugin(),
  ],
  devtool: "inline-source-map",
  devServer: {
    port: 8080,
    compress: true,
    hot: true,
    historyApiFallback: {
      index: "/",
    },
  },
};

export default config;
