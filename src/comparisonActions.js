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

// const createDirectories = (fs, config) =>
//   new Promise(resolve => {
// const branch = config.branch;
// var latest = config.latest;
// var generatedDiffs = config.generatedDiffs;
// var baseline = config.baseline;

// const directories = [];
// directories.push(latest, generatedDiffs, baseline);

// if (branch) {
//   latest = `${config.latest}/${branch}`;
//   generatedDiffs = `${config.generatedDiffs}/${branch}`;
//   baseline = `${config.baseline}/${branch}`;
//   logger.info('branch', 'using branches');
//   logger.info('branch', config.branch);

//   const directoryExists = fs.existsSync(branch) ? true : false;
//   if (!directoryExists) fs.mkdirSync(branch);
// }

//   directories.push(latest, generatedDiffs, baseline);

//   directories.forEach(dir => {
//     const directoryExists = fs.existsSync(dir) ? true : false;

//     if (!directoryExists) fs.mkdirSync(dir);
//   });

//   resolve();
// });
const createDirectories = (fs, config) =>
  new Promise(resolve => {
    const directories = [];
    directories.push(config.latest, config.generatedDiffs, config.baseline);

    directories.forEach(dir => {
      const directoryExists = fs.existsSync(dir) ? true : false;

      if (!directoryExists) fs.mkdirSync(dir);
    });

    resolve();
  });

const clearDirectories = (fs, config) =>
  new Promise(resolve => {
    const diffsPath = path.resolve(config.generatedDiffs);
    const reportPath = path.resolve(config.report);
    [diffsPath, reportPath].forEach(dir => {
      const directoryExists = fs.existsSync(dir) ? true : false;

      if (directoryExists) {
        fs.readdirSync(dir).forEach(file => {
          fs.unlinkSync(`${dir}/${file}`);
        });
      }
    });

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
