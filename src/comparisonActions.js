import path from 'path';
import looksSame, { createDiff } from 'looks-same';
import { promisify } from 'util';
import {
  createRemote,
  deleteRemoteKeys,
  fetchRemoteKeys,
  uploadRemoteKeys,
  updateRemotePolicy
} from './remoteActions';
import createDiffImage from './createDiffs';
import comparisonDataConstructor from './comparisonDataConstructor';
import isEqual from './comparer';
import logger from './logger';

const createBucket = async config => {
  if (config.remote) {
    await createRemote(config)
      .then(async () => {
        logger.info(
          'comparison-actions',
          `${config.remoteBucketName} bucket has been created`
        );
        await updateRemotePolicy(config);
      })
      .catch(() => {
        logger.info('comparison-actions', 'Bucket already created');
      });
  }
};

const createComparisons = async (fs, config, reporter) => {
  const comparisonData = await comparisonDataConstructor(fs, config);
  const looksSameAsync = promisify(looksSame);

  for (let i = 0; i < comparisonData.length; i++) {
    const scenario = comparisonData[i];
    const equal = await isEqual(scenario, looksSameAsync);

    if (equal) {
      reporter.pass(scenario.label);
    } else {
      reporter.fail(scenario.label);
      await createDiffImage(scenario, createDiff);
    }
  }

  if (config.remote)
    await uploadRemoteKeys('generatedDiffs', config)
      .then(() =>
        logger.info('upload-remote', 'Files uploaded successfully ✅')
      )
      .catch(error =>
        logger.error('upload-remote', `Error uploading files ❌  ${error}`)
      );

  reporter.generateReport();
};

const createDirectories = (fs, config) =>
  new Promise(resolve => {
    const branch = config.branch;
    var latest = config.latest;
    var generatedDiffs = config.generatedDiffs;
    var baseline = config.baseline;

    const directories = [];

    if (branch) {
      latest = latest.replace(
        path.basename(latest),
        `${branch}/${path.basename(latest)}`
      );

      generatedDiffs = generatedDiffs.replace(
        path.basename(generatedDiffs),
        `${branch}/${path.basename(generatedDiffs)}`
      );

      baseline = baseline.replace(
        path.basename(baseline),
        `${branch}/${path.basename(baseline)}`
      );
      var branchfolderExists = fs.existsSync(branch) ? true : false;

      if (!branchfolderExists) fs.mkdirSync(branch);
      // logger.info('branch', config.branch);
    }
    logger.info('latest', latest);
    logger.info('gendiff', generatedDiffs);
    logger.info('baseline', baseline);
    directories.push(latest, generatedDiffs, baseline);

    directories.forEach(dir => {
      var directoryExists = fs.existsSync(dir) ? true : false;

      if (!directoryExists) fs.mkdirSync(dir);
    });

    resolve();
  });

const clearDirectories = (fs, config) =>
  new Promise(resolve => {
    const diffsPath = path
      .resolve(config.generatedDiffs)
      .replace(
        path.basename(config.generatedDiffs),
        `${config.branch}/${path.basename(config.generatedDiffs)}`
      );
    const reportPath = path.resolve(config.report);
    const branch = config.branch;
    [diffsPath, reportPath].forEach(dir => {
      logger.info('diffpath', diffsPath);
      const directoryExists = fs.existsSync(dir) ? true : false;
      const branchExists = fs.existsSync(branch) ? true : false;
      if (directoryExists) {
        fs.readdirSync(dir).forEach(file => {
          fs.unlinkSync(`${dir}/${file}`);
          if (branchExists) fs.unlinkSync(branch);
        });
      }
    });
    // [branch].forEach(Branchdir => {
    //   const branchExists = fs.existsSync(branch) ? true : false;

    //   if (branchExists) {
    //     fs.unlinkSync(`${Branchdir}`);
    //   }
    // });

    resolve();
  });

// const clearDirectories = (fs, config) =>
//   new Promise(resolve => {
//     const diffsPath = path.resolve(config.generatedDiffs);
//     const reportPath = path.resolve(config.report);
//     const branch = config.branch;

//     [diffsPath, reportPath].forEach(dir => {
//       const directoryExists = fs.existsSync(dir) ? true : false;

//       if (directoryExists) {
//         fs.readdirSync(dir).forEach(file => {
//           fs.unlinkSync(`${dir}/${file}`);
//         });
//       }
//     });
// [branch].forEach(Branchdir => {
//   const branchExists = fs.existsSync(branch) ? true : false;

//   if (branchExists) {
//     // fs.unlinkSync(`${Branchdir}`);
//     fs.unlinkSync(`${generatedDiffs}/Leto`);
//   }
// });

//   resolve();
// });

const fetchRemoteComparisonImages = async config => {
  if (config.remote) {
    await deleteRemoteKeys('generatedDiffs', config);
    logger.info('comparisonActions', 'Getting baseline images from S3...');
    const promises = [];

    config.scenarios.map(scenario =>
      scenario.viewports.map(viewport => {
        const fetchRemotePromise = fetchRemoteKeys(
          config,
          'baseline',
          `${scenario.label}-${viewport.label}.png`
        );
        promises.push(fetchRemotePromise);
      })
    );

    return Promise.all(promises);
  }
};

export {
  createBucket,
  createComparisons,
  createDirectories,
  clearDirectories,
  fetchRemoteComparisonImages
};
