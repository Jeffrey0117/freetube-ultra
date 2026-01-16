#!/usr/bin/env node
/**
 * FreeTube Local API Server - Test Runner
 * 統一測試執行器
 *
 * Usage:
 *   node server/test-runner.js           # 執行所有測試
 *   node server/test-runner.js --watch   # 監聽模式
 *   node server/test-runner.js --filter <pattern>  # 過濾測試檔案
 *   node server/test-runner.js --help    # 顯示說明
 */

const { spawn, fork } = require('child_process')
const path = require('path')
const fs = require('fs')

// 命令列參數解析
const args = process.argv.slice(2)
const options = {
  watch: args.includes('--watch') || args.includes('-w'),
  help: args.includes('--help') || args.includes('-h'),
  verbose: args.includes('--verbose') || args.includes('-v'),
  filter: null,
  files: []
}

// 解析 --filter 參數
const filterIndex = args.findIndex(a => a === '--filter' || a === '-f')
if (filterIndex !== -1 && args[filterIndex + 1]) {
  options.filter = args[filterIndex + 1]
}

// 收集非選項參數作為指定的測試檔案
for (const arg of args) {
  if (!arg.startsWith('-') && arg !== options.filter) {
    options.files.push(arg)
  }
}

// 顯示說明
function showHelp() {
  console.log(`
FreeTube Test Runner
====================

Usage:
  node server/test-runner.js [options] [files...]

Options:
  -h, --help      Show this help message
  -w, --watch     Watch mode - re-run tests on file changes
  -v, --verbose   Verbose output
  -f, --filter    Filter test files by pattern

Examples:
  node server/test-runner.js                    # Run all tests
  node server/test-runner.js --watch            # Watch mode
  node server/test-runner.js cache              # Run cache tests only
  node server/test-runner.js --filter cache     # Filter by pattern
  node server/test-runner.js auth               # Run auth related tests
  node server/test-runner.js user               # Run user module tests

Test Files:
  Server Tests:
  - server/cache/cache.test.js         - Cache system unit tests
  - server/integration.test.js         - API integration tests
  - server/proxy.test.js               - Proxy system tests
  - server/routes/routes.test.js       - Routes unit tests
  - server/routes/auth.test.js         - Auth API endpoint tests
  - server/services/userService.test.js - User service tests
  - server/auth.integration.test.js    - Auth integration tests

  Frontend Tests:
  - src/renderer/helpers/auth.test.js  - Auth utilities tests
  - src/renderer/store/modules/user.test.js - User Vuex module tests
`)
  process.exit(0)
}

if (options.help) {
  showHelp()
}

// 測試檔案發現
const TEST_DIR = path.join(__dirname)
const PROJECT_ROOT = path.join(__dirname, '..')
const TEST_PATTERN = /\.test\.js$/

// 測試目錄配置
const TEST_DIRECTORIES = [
  TEST_DIR,                                         // server/
  path.join(PROJECT_ROOT, 'src/renderer/helpers'),  // src/renderer/helpers/
  path.join(PROJECT_ROOT, 'src/renderer/store/modules')  // src/renderer/store/modules/
]

function findTestFiles(dirs = TEST_DIRECTORIES, files = []) {
  for (const baseDir of dirs) {
    if (!fs.existsSync(baseDir)) continue

    const findInDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.test-users') {
          findInDir(fullPath)
        } else if (entry.isFile() && TEST_PATTERN.test(entry.name)) {
          files.push(fullPath)
        }
      }
    }

    findInDir(baseDir)
  }

  return files
}

function filterFiles(files, pattern) {
  if (!pattern) return files

  const regex = new RegExp(pattern, 'i')
  return files.filter(file => regex.test(file))
}

// 測試結果收集器
class TestResults {
  constructor() {
    this.files = []
    this.totalPassed = 0
    this.totalFailed = 0
    this.totalSkipped = 0
    this.startTime = Date.now()
  }

  addFileResult(file, result) {
    this.files.push({ file, ...result })
    this.totalPassed += result.passed || 0
    this.totalFailed += result.failed || 0
    this.totalSkipped += result.skipped || 0
  }

  get duration() {
    return Date.now() - this.startTime
  }

  get totalTests() {
    return this.totalPassed + this.totalFailed + this.totalSkipped
  }

  print() {
    console.log('\n')
    console.log('╔══════════════════════════════════════════════════════════════╗')
    console.log('║                    TEST RESULTS SUMMARY                      ║')
    console.log('╠══════════════════════════════════════════════════════════════╣')

    for (const fileResult of this.files) {
      const status = fileResult.failed > 0 ? '✗' : '✓'
      const statusColor = fileResult.failed > 0 ? '\x1b[31m' : '\x1b[32m'
      const reset = '\x1b[0m'
      const fileName = path.relative(TEST_DIR, fileResult.file)

      console.log(`║ ${statusColor}${status}${reset} ${fileName.padEnd(55)} ║`)
      console.log(`║   Passed: ${String(fileResult.passed).padEnd(5)} Failed: ${String(fileResult.failed).padEnd(5)} Skipped: ${String(fileResult.skipped).padEnd(5)} ║`)
    }

    console.log('╠══════════════════════════════════════════════════════════════╣')
    console.log(`║ Total Tests: ${String(this.totalTests).padEnd(48)} ║`)
    console.log(`║   ✓ Passed:  ${String(this.totalPassed).padEnd(47)} ║`)
    console.log(`║   ✗ Failed:  ${String(this.totalFailed).padEnd(47)} ║`)
    console.log(`║   ○ Skipped: ${String(this.totalSkipped).padEnd(47)} ║`)
    console.log(`║ Duration: ${String(this.duration + 'ms').padEnd(50)} ║`)
    console.log('╚══════════════════════════════════════════════════════════════╝')

    if (this.totalFailed > 0) {
      console.log('\n\x1b[31mSome tests failed!\x1b[0m')
    } else {
      console.log('\n\x1b[32mAll tests passed!\x1b[0m')
    }
  }

  toJSON() {
    return {
      files: this.files,
      summary: {
        total: this.totalTests,
        passed: this.totalPassed,
        failed: this.totalFailed,
        skipped: this.totalSkipped,
        duration: this.duration
      }
    }
  }
}

// 執行單一測試檔案
function runTestFile(filePath) {
  return new Promise((resolve) => {
    const fileName = path.relative(TEST_DIR, filePath)
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`Running: ${fileName}`)
    console.log('─'.repeat(60))

    const child = fork(filePath, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env, NODE_ENV: 'test' }
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      const text = data.toString()
      stdout += text
      process.stdout.write(text)
    })

    child.stderr.on('data', (data) => {
      const text = data.toString()
      stderr += text
      process.stderr.write(text)
    })

    child.on('close', (code) => {
      // 嘗試從輸出解析測試結果
      const passedMatch = stdout.match(/Passed?:?\s*(\d+)/i)
      const failedMatch = stdout.match(/Failed?:?\s*(\d+)/i)
      const skippedMatch = stdout.match(/Skipped?:?\s*(\d+)/i)

      resolve({
        passed: passedMatch ? parseInt(passedMatch[1]) : 0,
        failed: failedMatch ? parseInt(failedMatch[1]) : (code !== 0 ? 1 : 0),
        skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0,
        exitCode: code
      })
    })

    child.on('error', (error) => {
      console.error(`Error running ${fileName}:`, error.message)
      resolve({
        passed: 0,
        failed: 1,
        skipped: 0,
        exitCode: 1,
        error: error.message
      })
    })
  })
}

// 執行所有測試
async function runAllTests(testFiles) {
  const results = new TestResults()

  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║           FreeTube Local API Test Runner                     ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log(`\nFound ${testFiles.length} test file(s)`)

  for (const file of testFiles) {
    const result = await runTestFile(file)
    results.addFileResult(file, result)
  }

  results.print()

  // 寫入 JSON 報告
  const reportPath = path.join(TEST_DIR, 'test-report.json')
  try {
    fs.writeFileSync(reportPath, JSON.stringify(results.toJSON(), null, 2))
    console.log(`\nTest report saved to: ${reportPath}`)
  } catch (e) {
    // 忽略報告寫入錯誤
  }

  return results
}

// 監聽模式
function watchMode(testFiles) {
  console.log('\n=== Watch Mode ===')
  console.log('Watching for file changes...')
  console.log('Press Ctrl+C to stop\n')

  let running = false
  let pendingRun = false

  const runTests = async () => {
    if (running) {
      pendingRun = true
      return
    }

    running = true
    console.clear()
    await runAllTests(testFiles)
    running = false

    if (pendingRun) {
      pendingRun = false
      runTests()
    }
  }

  // 監聽測試檔案變化
  const watchDirs = new Set()
  for (const file of testFiles) {
    watchDirs.add(path.dirname(file))
  }

  for (const dir of watchDirs) {
    fs.watch(dir, { recursive: true }, (eventType, filename) => {
      if (filename && (filename.endsWith('.js') || filename.endsWith('.test.js'))) {
        console.log(`\n[${new Date().toLocaleTimeString()}] Change detected: ${filename}`)
        runTests()
      }
    })
  }

  // 也監聽 server 目錄下的源碼檔案
  const serverDir = path.join(__dirname)
  fs.watch(serverDir, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('.js') && !filename.endsWith('.test.js')) {
      console.log(`\n[${new Date().toLocaleTimeString()}] Source change: ${filename}`)
      runTests()
    }
  })

  // 初始執行
  runTests()
}

// 主函數
async function main() {
  // 發現測試檔案
  let testFiles = findTestFiles()

  // 應用過濾器
  if (options.filter) {
    testFiles = filterFiles(testFiles, options.filter)
  }

  // 如果指定了特定檔案
  if (options.files.length > 0) {
    testFiles = testFiles.filter(file => {
      const fileName = path.basename(file, '.test.js')
      return options.files.some(f =>
        file.includes(f) ||
        fileName.includes(f) ||
        path.relative(TEST_DIR, file).includes(f)
      )
    })
  }

  if (testFiles.length === 0) {
    console.log('No test files found matching the criteria.')
    process.exit(0)
  }

  if (options.verbose) {
    console.log('Test files to run:')
    testFiles.forEach(f => console.log(`  - ${path.relative(TEST_DIR, f)}`))
  }

  if (options.watch) {
    watchMode(testFiles)
  } else {
    const results = await runAllTests(testFiles)
    process.exit(results.totalFailed > 0 ? 1 : 0)
  }
}

// 執行
main().catch(error => {
  console.error('Test runner failed:', error)
  process.exit(1)
})
