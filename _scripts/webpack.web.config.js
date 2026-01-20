const path = require('path')
const fs = require('fs')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { VueLoaderPlugin } = require('vue-loader')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const JsonMinimizerPlugin = require('json-minimizer-webpack-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const ProcessLocalesPlugin = require('./ProcessLocalesPlugin')
const {
  SHAKA_LOCALE_MAPPINGS,
  SHAKA_LOCALES_PREBUNDLED,
  SHAKA_LOCALES_TO_BE_BUNDLED
} = require('./getShakaLocales')

const isDevMode = process.env.NODE_ENV === 'development'

const { version: swiperVersion } = JSON.parse(fs.readFileSync(path.join(__dirname, '../node_modules/swiper/package.json')))

// 從 .env.local 讀取 YouTube Cookie
function loadYouTubeCookieFromEnv() {
  const envLocalPath = path.join(__dirname, '../.env.local')
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf-8')
    const match = content.match(/^YOUTUBE_COOKIE=(.*)$/m)
    if (match) {
      return match[1].trim()
    }
  }
  return ''
}

/** @type {import('webpack').Configuration} */
const config = {
  name: 'web',
  mode: process.env.NODE_ENV,
  devtool: isDevMode ? 'eval-cheap-module-source-map' : false,
  entry: {
    web: path.join(__dirname, '../src/renderer/main.js'),
  },
  output: {
    path: path.join(__dirname, '../dist/web'),
    filename: '[name].js',
  },
  // 不再排除 youtubei.js，使用 web 版本支援 Local API
  module: {
    rules: [
      // 對 nedb 和 util 注入 process polyfill（避免與 protobuf 衝突）
      {
        test: /[\\/]node_modules[\\/](@seald-io[\\/]nedb|util)[\\/].*\.js$/,
        use: [
          {
            loader: 'imports-loader',
            options: {
              additionalCode: 'var process = require("process/browser");',
            },
          },
        ],
      },
      {
        test: /\.js$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          compilerOptions: {
            isCustomElement: (tag) => tag === 'swiper-container' || tag === 'swiper-slide',
          }
        }
      },
      {
        test: /\.scss$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
          },
          {
            loader: 'css-loader',
            options: {
              esModule: false
            }
          },
          {
            loader: 'sass-loader',
            options: {
              implementation: require('sass')
            }
          },
        ],
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader
          },
          {
            loader: 'css-loader',
            options: {
              esModule: false
            }
          }
        ],
      },
      {
        test: /\.html$/,
        use: 'vue-html-loader',
      },
      {
        test: /\.(png|jpe?g|gif|tif?f|bmp|webp|svg)(\?.*)?$/,
        type: 'asset/resource',
        generator: {
          filename: 'imgs/[name][ext]'
        }
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext]'
        }
      },
    ],
    generator: {
      json: {
        JSONParse: false
      }
    }
  },
  // webpack defaults to only optimising the production builds, so having this here is fine
  optimization: {
    minimizer: [
      '...', // extend webpack's list instead of overwriting it
      new JsonMinimizerPlugin({
        exclude: /\/locales\/.*\.json/
      }),
      new CssMinimizerPlugin()
    ]
  },
  node: {
    __dirname: false,
    __filename: false
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.platform': 'undefined',
      'process.env.IS_ELECTRON': false,
      'process.env.IS_ELECTRON_MAIN': false,
      // 網頁版使用 Invidious API 模式，但透過 proxy 指向本地 API Server（支援 cookie 認證）
      'process.env.SUPPORTS_LOCAL_API': false,
      'process.env.YOUTUBE_COOKIE': JSON.stringify(loadYouTubeCookieFromEnv()),
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
      __VUE_I18N_LEGACY_API__: 'true',
      __VUE_I18N_FULL_INSTALL__: 'false',
      __INTLIFY_PROD_DEVTOOLS__: 'false',
      'process.env.SWIPER_VERSION': `'${swiperVersion}'`
    }),
    new HtmlWebpackPlugin({
      excludeChunks: ['processTaskWorker'],
      filename: 'index.html',
      template: path.resolve(__dirname, '../src/index.ejs')
    }),
    new VueLoaderPlugin(),
    new MiniCssExtractPlugin({
      filename: isDevMode ? '[name].css' : '[name].[contenthash].css',
      chunkFilename: isDevMode ? '[id].css' : '[id].[contenthash].css',
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(__dirname, '../node_modules/swiper/modules/{a11y,navigation,pagination}-element.css').replaceAll('\\', '/'),
          to: `swiper-${swiperVersion}.css`,
          context: path.join(__dirname, '../node_modules/swiper/modules'),
          transformAll: (assets) => {
            return Buffer.concat(assets.map(asset => asset.data))
          }
        }
      ]
    })
  ],
  resolve: {
    alias: {
      DB_HANDLERS_ELECTRON_RENDERER_OR_WEB$: path.resolve(__dirname, '../src/datastores/handlers/web.js'),

      // 使用 youtubei.js 的 web 版本，支援瀏覽器環境
      'youtubei.js$': 'youtubei.js/web',

      // change to "shaka-player.ui.debug.js" to get debug logs (update jsconfig to get updated types)
      'shaka-player$': 'shaka-player/dist/shaka-player.ui.js',

      // Make @fortawesome/vue-fontawesome use the trimmed down API instead of the original @fortawesome/fontawesome-svg-core
      '@fortawesome/fontawesome-svg-core$': path.resolve(__dirname, '../src/renderer/fontawesome-minimal.js')
    },
    extensions: ['.js', '.vue'],
    fallback: {
      // Node.js built-ins 的瀏覽器 polyfill
      process: require.resolve('process/browser'),
    }
  },
  target: 'web',
}

const processLocalesPlugin = new ProcessLocalesPlugin({
  compress: false,
  hotReload: isDevMode,
  inputDir: path.join(__dirname, '../static/locales'),
  outputDir: 'static/locales',
})

config.plugins.push(
  processLocalesPlugin,
  new webpack.DefinePlugin({
    'process.env.LOCALE_NAMES': JSON.stringify(processLocalesPlugin.localeNames),
    'process.env.GEOLOCATION_NAMES': JSON.stringify(fs.readdirSync(path.join(__dirname, '..', 'static', 'geolocations')).map(filename => filename.replace('.json', ''))),
    'process.env.SHAKA_LOCALE_MAPPINGS': JSON.stringify(SHAKA_LOCALE_MAPPINGS),
    'process.env.SHAKA_LOCALES_PREBUNDLED': JSON.stringify(SHAKA_LOCALES_PREBUNDLED)
  }),
  new CopyWebpackPlugin({
    patterns: [
      {
        from: path.join(__dirname, '../static/pwabuilder-sw.js'),
        to: path.join(__dirname, '../dist/web/pwabuilder-sw.js'),
      },
      {
        from: path.join(__dirname, '../static'),
        to: path.join(__dirname, '../dist/web/static'),
        globOptions: {
          dot: true,
          ignore: ['**/.*', '**/locales/**', '**/pwabuilder-sw.js', '**/dashFiles/**', '**/storyboards/**'],
        },
      },
      {
        from: path.join(__dirname, '../node_modules/shaka-player/ui/locales', `{${SHAKA_LOCALES_TO_BE_BUNDLED.join(',')}}.json`).replaceAll('\\', '/'),
        to: path.join(__dirname, '../dist/web/static/shaka-player-locales'),
        context: path.join(__dirname, '../node_modules/shaka-player/ui/locales')
      }
    ]
  })
)

module.exports = config
