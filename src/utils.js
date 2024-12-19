const fs = require("fs");
const os = require("os");
const chalk = require('chalk')
const rimraf = require('rimraf')
const fsExtra = require("fs-extra");
const glob = require("glob");
const path = require("path");
const appRoot = require('app-root-path');
const rootDir = appRoot.toString().replaceAll("\\", "/");
const sumoConfig = require(rootDir + "/sumo-config");

//Static configuration
const config = {
  sumoDir: rootDir + "/sumo",
  sumoInstallPath: rootDir + "/node_modules/@geriul/sumo",
  mutantsDir: rootDir + "/sumo/results/mutants",
  reportTxt: rootDir + "/sumo/results/sumo-log.txt",
  resultsDir: rootDir + "/sumo/results",
  baselineDir: rootDir + "/sumo/baseline",
  mutOpsConfig: rootDir + "/node_modules/@geriul/sumo/src/operators.config.json",
  contractsGlob: '/**/*.sol',
  packageManagerGlob: ['/package-lock.json', '/yarn.lock'],
  testsGlob: '/**/*.{js,mjs,sol,ts,py}',
}

/**
 * Prepares the results directory
 */
function setupResultsDir() {
  let resultDirs = [config.resultsDir, config.mutantsDir];
  resultDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  });
}

/**
 * Restores the SUT files
 */
function restore() {
  const contractsDir = getContractsDir();
  const testDir = getTestDir();

  if (fs.existsSync(config.baselineDir)) {

    //Restore contracts
    glob(config.baselineDir + '/contracts' + config.contractsGlob, (err, files) => {
      if (err) throw err;

      for (const file of files) {
        let relativeFilePath = file.split("sumo/baseline/contracts")[1];
        let fileDir = path.dirname(relativeFilePath);
        fs.mkdir(contractsDir + fileDir, { recursive: true }, function (err) {
          if (err) return cb(err);

          fs.copyFile(file, contractsDir + relativeFilePath, (err) => {
            if (err) throw err;
          });
        });
      }
    });

    //Restore tests
    glob(config.baselineDir + '/test' + config.testsGlob, (err, files) => {
      if (err) throw err;

      for (const file of files) {
        let relativeFilePath = file.split("sumo/baseline/test")[1];
        let fileDir = path.dirname(relativeFilePath);
        fs.mkdir(testDir + fileDir, { recursive: true }, function (err) {
          if (err) return cb(err);

          fs.copyFile(file, testDir + relativeFilePath, (err) => {
            if (err) throw err;
          });
        });
      }
    });

    console.log("Project restored.");
  } else {
    console.log("Project was not restored (No baseline available).");
  }
}

/**
 * Cleans the build dir
 */
function cleanBuildDir() {
  const buildDir = getBuildDir();
  fsExtra.emptyDirSync(buildDir);
  console.log("Build directory cleaned");
}

/**
 * Cleans the results dir
 */
function cleanResultsDir() {
  if (fs.existsSync(config.resultsDir)) {
    fsExtra.emptyDirSync(config.resultsDir);
    console.log("Results directory cleaned\n");
    setupResultsDir();
  }
}

/**
 * Cleans the temporary files generated by Ganache
 */
function cleanTmp() {
  var dir = os.tmpdir();
  fs.readdirSync(dir).forEach(f => {
    if (f.substring(0, 4) === 'tmp-' || f.startsWith("ganache")) {
      try {
        rimraf.sync(`${dir}/${f}`)
        //console.log(f + ' deleted')
      } catch (error) {
        //console.log(error);
      }
    }
  });
  console.log("Ganache killed and temp files deleted\n");
}

//Checks the package manager used by the SUT
function getPackageManager() {
  let packageManager = null;

  for (const lockFile of config.packageManagerGlob) {
    if (fs.existsSync(rootDir + lockFile)) {
      if (lockFile.includes("yarn")) {
        packageManager = "yarn";
      } else {
        packageManager = "npm";
      }
      break;
    }
  }
  if (packageManager === null) {
    console.error(chalk.red("Error: Cannot detect used package manager (the project does not include a valid lock file)."));
    process.exit(1);
  }
  return packageManager;
}

/**
 * Get the contracts directory
 * @returns the path of the contracts directory
 */
function getContractsDir() {
  const validContractsDirs = [
    sumoConfig.contractsDir && sumoConfig.contractsDir !== '' ? "/" + sumoConfig.contractsDir : null,
    "/contracts",
    "/src"
  ];

  const foundDir = validContractsDirs.find(dir => {
    const fullPath = rootDir + dir;
    return dir && dir.replace(/\s/g, "") !== "" && fs.existsSync(fullPath);
  });

  if (foundDir) {
    return rootDir + foundDir;
  } else {
    console.error(chalk.red("Error: No valid contract directory found in " + rootDir + ".\nPlease specify a contract directory in your sumo-config.js"));
    process.exit(1);
  }
}

/**
 * Get the test directory
 * @returns the path of the test directory
 */
function getTestDir() {
  const validTestDirs = [
    sumoConfig.testDir && sumoConfig.testDir !== '' ? "/" + sumoConfig.testDir : null,
    "/test",
    "/tests"
  ];

  const foundDir = validTestDirs.find(dir => {
    const fullPath = rootDir + dir;
    return dir && dir.replace(/\s/g, "") !== "" && fs.existsSync(fullPath);
  });

  if (foundDir) {
    return rootDir + foundDir;
  } else {
    console.error(chalk.red("Error: No valid test directory found in " + rootDir + ".\nPlease specify a test directory in your sumo-config.js"));
    process.exit(1);
  }
}



/**
 * Get the build directory
 * @returns the path of the build directory
 */
function getBuildDir() {
  const validBuildDirs = [
    sumoConfig.buildDir && sumoConfig.buildDir !== '' ? "/" + sumoConfig.buildDir : null,
    "/build/artifacts/contracts",
    "/build/artifacts",
    "/build",
    "/output",
    "/out",
    "/artifacts/contracts",
    "/artifacts"
  ];

  const foundDir = validBuildDirs.find(dir => {
    const fullPath = rootDir + dir;
    return dir && dir.replace(/\s/g, "") !== "" && fs.existsSync(fullPath);
  });

  if (foundDir) {
    return rootDir + foundDir;
  } else {
    console.error(chalk.red("Error: No valid build directory found in " + rootDir + ".\nPlease compile your contracts and/or specify a build directory in your sumo-config.js"));
    process.exit(1);
  }
}


module.exports = {
  getBuildDir: getBuildDir,
  getTestDir: getTestDir,
  getContractsDir: getContractsDir,
  setupResultsDir: setupResultsDir,
  restore: restore,
  cleanBuildDir: cleanBuildDir,
  cleanResultsDir: cleanResultsDir,
  cleanTmp: cleanTmp,
  getPackageManager: getPackageManager,
  config: config
};
