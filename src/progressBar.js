import cliProgress from 'cli-progress';

class ProgressBar {
  constructor() {
    this._cliProgress = new cliProgress.Bar(
      {
        barsize: 65,
        stopOnComplete: true,
        stream: process.stderr,
        linewrap: true,
        clearOnComplete: false,
        format:
          '\n Progress [{bar}] {percentage}% | ETA: {eta}s | Snapped {value}/{total} \n'
      },
      cliProgress.Presets.legacy
    );
    this._sizeOfProgressBar = 0;
    this._tick = 0;
  }

  subscribe() {
    this._sizeOfProgressBar++;
  }

  start() {
    this._cliProgress.start(this._sizeOfProgressBar, 0);
  }

  tick() {
    this._tick++;
    this._cliProgress.update(this._tick);
  }
}

export default new ProgressBar();
