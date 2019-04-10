import pug from 'pug';
import path from 'path';
import fs from 'fs';
import logger from './logger';
import { listRemoteKeys, uploadRemoteKeys } from './remoteActions';

const createReportData = config => {
  const report = [];

  for (let i = 0; i < config.scenarios.length; i++) {
    const scenario = config.scenarios[i];
    scenario.viewports.forEach(viewport => {
      const name = `${scenario.label}-${viewport.label}`;
      const imageName = `${name}.png`;
      const branch = config.branch;

      const baselinePath = path.relative(
        config.report,
        `${config.baseline}/${branch}/${imageName}`
      );
      const latestPath = path.relative(
        config.report,
        `${config.latest}/${branch}/${imageName}`
      );
      const generatedAbsolutePath = path.resolve(
        `${config.generatedDiffs}/${branch}/${imageName}`
      );
      const generatedDiffsPath = path.relative(
        config.report,
        `${config.generatedDiffs}/${branch}/${imageName}`
      );

      // logger.info('baselinePath', baselinePath);
      // logger.info('latestPath', latestPath);
      // logger.info('generatedAbsolutePath', generatedAbsolutePath);
      // logger.info('generatedDiffsPath', generatedDiffsPath);

      if (fs.existsSync(generatedAbsolutePath)) {
        logger.info('generate-report', `found diff for ${name}`);
        const scenarioData = {
          label: name,
          baseline: `/${branch}/baselinePath`,
          latest: `/${branch}/latestPath`,
          generatedDiff: `/${branch}/generatedDiffsPath`,
          branch: branch
        };
        logger.info('data', 'hmm');

        report.push(scenarioData);
      }
    });
  }
  return report;
};
const createRemoteReportData = (url, diffs) =>
  diffs.map(diff => {
    const [browser, branch, key, scenario] = diff.Key.split('/'); //eslint-disable-line no-unused-vars
    const scenarioName = scenario.split('.png')[0];

    return {
      label: scenarioName,
      baseline: `${url}${browser}/${branch}/baseline/${scenario}`,
      latest: `${url}${browser}/${branch}/latest/${scenario}`,
      generatedDiff: `${url}${browser}/${branch}/generatedDiffs/${scenario}`
    };
  });

const generateLocalReport = async config =>
  writeReport(config, createReportData(config));

const writeReport = (config, reportsData) => {
  const templatePath = path.join(__dirname, '../templates/report.pug');
  const compileTemplate = pug.compileFile(templatePath);
  const reportPresentation = compileTemplate({ reportsData });
  const reportDir = path.resolve(config.report);

  logger.info('branchly', config.branch);
  logger.info('reportDir', reportDir);
  try {
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir);
    fs.writeFileSync(`${reportDir}/index.html`, reportPresentation);
    logger.info('generate-report', 'successfully created report!unicorn');
    return `${reportDir}/index.html`;
  } catch (err) {
    logger.error(err);
    process.exitCode = 1;
  }
};

const generateRemoteReport = async config => {
  const filteredResults = await listRemoteKeys('generatedDiffs', config);
  const url = `https://s3-${config.remoteRegion}.amazonaws.com/${
    config.remoteBucketName
  }/`;
  await writeReport(config, createRemoteReportData(url, filteredResults));
  await uploadRemoteKeys('report', config);
};

export { generateLocalReport, generateRemoteReport };
