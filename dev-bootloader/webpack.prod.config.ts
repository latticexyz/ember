import path from "path";
import webpack from "webpack";
import HtmlWebpackPlugin from "html-webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";

const config: webpack.Configuration = {
  mode: "production",
  target: "web",
  output: {
    path: path.join(__dirname, "/dist"),
    filename: "bundle-[contenthash:6].min.js",
    publicPath: "/",
  },
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
    new webpack.EnvironmentPlugin(["NODE_ENV"]),
  ],
};

export default config;
